import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type RecognitionRequest = {
  image_data_url?: string;
};

type Candidate = {
  equipment_type: string;
  manufacturer: string | null;
  model: string | null;
  confidence: number;
};

type EquipmentRecognition = {
  equipment_type: string;
  manufacturer: string | null;
  model: string | null;
  likely_exercises: string[];
  primary_muscles: string[];
  confidence: number;
  distinguishing_features: string[];
  notes: string;
  candidate_matches: Candidate[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const schema = {
  type: "object",
  properties: {
    equipment_type: { type: "string" },
    manufacturer: { anyOf: [{ type: "string" }, { type: "null" }] },
    model: { anyOf: [{ type: "string" }, { type: "null" }] },
    likely_exercises: { type: "array", items: { type: "string" } },
    primary_muscles: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    distinguishing_features: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
    candidate_matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          equipment_type: { type: "string" },
          manufacturer: { anyOf: [{ type: "string" }, { type: "null" }] },
          model: { anyOf: [{ type: "string" }, { type: "null" }] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["equipment_type", "manufacturer", "model", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "equipment_type",
    "manufacturer",
    "model",
    "likely_exercises",
    "primary_muscles",
    "confidence",
    "distinguishing_features",
    "notes",
    "candidate_matches",
  ],
  additionalProperties: false,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const body = await req.json() as RecognitionRequest;
    const imageDataUrl = body.image_data_url;

    if (!imageDataUrl || !/^data:image\/(jpeg|png|webp);base64,/.test(imageDataUrl)) {
      return json({
        error: "A JPEG, PNG or WebP image is required.",
        code: "INVALID_IMAGE",
      }, 400);
    }

    if (imageDataUrl.length > 14_000_000) {
      return json({
        error: "Image is too large. Compress it before recognition.",
        code: "IMAGE_TOO_LARGE",
      }, 413);
    }

    const gatewayUrl = Deno.env.get("DE_AI_VISION_URL");
    const gatewayToken = Deno.env.get("DE_AI_VISION_TOKEN");

    if (!gatewayUrl) {
      console.error("recognise-equipment configuration error: DE_AI_VISION_URL is missing");
      return json({
        error: "De-AI Vision is not configured.",
        code: "DE_AI_VISION_URL_MISSING",
      }, 503);
    }

    if (!gatewayToken) {
      console.error("recognise-equipment configuration error: DE_AI_VISION_TOKEN is missing");
      return json({
        error: "De-AI Vision authentication is not configured.",
        code: "DE_AI_VISION_TOKEN_MISSING",
      }, 503);
    }

    const response = await fetch(gatewayUrl, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Authorization": "Bearer " + gatewayToken,
        "Content-Type": "application/json",
        "X-De-AI-Product": "de-exercise",
        "X-De-AI-Capability": "gym-equipment-identification.v1",
      },
      body: JSON.stringify({
        capability: "gym-equipment-identification.v1",
        image: {
          data_url: imageDataUrl,
        },
        instruction: [
          "Identify the gym exercise equipment in this photo.",
          "Prioritise the machine family and exercise purpose.",
          "Use visible geometry, pads, handles, weight stack or plate horns, cable routing, movement path, labels, logos, and model markings as evidence.",
          "Name the manufacturer or model only when genuinely supported by visible evidence.",
          "Return likely exercises and primary muscles.",
          "If several identities remain plausible, lower confidence and return the strongest alternatives in candidate_matches.",
          "If the image is unclear or unrelated to exercise equipment, return equipment_type 'unknown', confidence 0, empty exercise and muscle arrays, and explain why in notes.",
        ].join(" "),
        response_schema: {
          name: "de_exercise_equipment_recognition",
          version: "1",
          schema,
        },
        metadata: {
          product: "de-exercise",
          purpose: "machine-identification",
        },
      }),
    });

    if (!response.ok) {
      const providerBody = await safeText(response);
      console.error("De-AI Vision failed", response.status, providerBody);

      if (response.status === 401 || response.status === 403) {
        return json({
          error: "De-AI Vision authentication failed.",
          code: "DE_AI_AUTH_FAILED",
        }, 502);
      }

      if (response.status === 429) {
        return json({
          error: "De-AI Vision is temporarily rate-limited.",
          code: "DE_AI_RATE_LIMITED",
        }, 503);
      }

      if (response.status >= 500) {
        return json({
          error: "De-AI Vision is temporarily unavailable.",
          code: "DE_AI_UNAVAILABLE",
        }, 503);
      }

      return json({
        error: "De-AI could not identify this equipment.",
        code: "DE_AI_REQUEST_FAILED",
      }, 502);
    }

    const payload = await response.json();
    const result = unwrapRecognition(payload);

    if (!isRecognitionResult(result)) {
      console.error("De-AI Vision returned an invalid equipment recognition payload");
      return json({
        error: "De-AI returned an invalid recognition result.",
        code: "DE_AI_INVALID_OUTPUT",
      }, 502);
    }

    return json(result, 200);
  } catch (error) {
    console.error("recognise-equipment unexpected error", error);

    if (error instanceof DOMException && error.name === "TimeoutError") {
      return json({
        error: "De-AI machine recognition timed out.",
        code: "DE_AI_TIMEOUT",
      }, 504);
    }

    return json({
      error: "Unexpected De-AI recognition error.",
      code: "UNEXPECTED_RECOGNITION_ERROR",
    }, 500);
  }
});

function unwrapRecognition(payload: unknown): unknown {
  if (
    payload &&
    typeof payload === "object" &&
    "result" in payload &&
    (payload as { result?: unknown }).result
  ) {
    return (payload as { result: unknown }).result;
  }

  return payload;
}

function isRecognitionResult(value: unknown): value is EquipmentRecognition {
  if (!value || typeof value !== "object") return false;

  const result = value as Record<string, unknown>;

  return typeof result.equipment_type === "string"
    && (typeof result.manufacturer === "string" || result.manufacturer === null)
    && (typeof result.model === "string" || result.model === null)
    && Array.isArray(result.likely_exercises)
    && Array.isArray(result.primary_muscles)
    && typeof result.confidence === "number"
    && result.confidence >= 0
    && result.confidence <= 1
    && Array.isArray(result.distinguishing_features)
    && typeof result.notes === "string"
    && Array.isArray(result.candidate_matches);
}

async function safeText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
