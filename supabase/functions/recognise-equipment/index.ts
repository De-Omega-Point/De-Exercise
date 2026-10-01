import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type RecognitionRequest = {
  image_data_url?: string;
};

type OpenAIContentPart = {
  type?: string;
  text?: string;
  refusal?: string;
};

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAIContentPart[];
};

type OpenAIResponse = {
  output?: OpenAIOutputItem[];
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

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      console.error("recognise-equipment configuration error: OPENAI_API_KEY is missing");
      return json({
        error: "Recognition service is not configured.",
        code: "OPENAI_API_KEY_MISSING",
      }, 503);
    }

    const model = Deno.env.get("OPENAI_VISION_MODEL") || "gpt-6-luna";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1200,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Identify the gym exercise equipment in this photo.",
                  "Prioritise the machine family and exercise purpose.",
                  "Use visible geometry, pads, handles, weight stack or plate horns, cable routing, movement path, labels, logos, and model markings as evidence.",
                  "Name the manufacturer or model only when it is genuinely supported by visible evidence.",
                  "Return likely exercises and primary muscles.",
                  "If several machine identities remain plausible, lower confidence and return the strongest alternatives in candidate_matches.",
                  "If the image is unclear or not exercise equipment, return equipment_type 'unknown', confidence 0, empty exercise and muscle arrays, and explain why in notes.",
                ].join(" "),
              },
              {
                type: "input_image",
                image_url: imageDataUrl,
                detail: "auto",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "equipment_recognition",
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error("OpenAI recognition failed", response.status, message);

      if (response.status === 401 || response.status === 403) {
        return json({
          error: "Machine recognition could not authenticate with the AI provider.",
          code: "OPENAI_AUTH_FAILED",
        }, 502);
      }

      if (response.status === 429) {
        return json({
          error: "Machine recognition is temporarily rate-limited.",
          code: "OPENAI_RATE_LIMITED",
        }, 503);
      }

      return json({
        error: "Equipment recognition failed.",
        code: "OPENAI_REQUEST_FAILED",
      }, 502);
    }

    const payload = await response.json() as OpenAIResponse;
    const refusal = extractRefusal(payload);

    if (refusal) {
      return json({
        error: "Recognition request was refused.",
        code: "OPENAI_REFUSAL",
      }, 422);
    }

    const outputText = extractOutputText(payload);

    if (!outputText) {
      console.error("OpenAI recognition response contained no output_text");
      return json({
        error: "Recognition response was incomplete.",
        code: "OPENAI_EMPTY_OUTPUT",
      }, 502);
    }

    const result = JSON.parse(outputText);

    if (typeof result.confidence !== "number" || typeof result.equipment_type !== "string") {
      console.error("OpenAI recognition response did not match the expected schema");
      return json({
        error: "Recognition response was invalid.",
        code: "OPENAI_INVALID_OUTPUT",
      }, 502);
    }

    return json(result, 200);
  } catch (error) {
    console.error("recognise-equipment unexpected error", error);

    if (error instanceof DOMException && error.name === "TimeoutError") {
      return json({
        error: "Machine recognition timed out.",
        code: "OPENAI_TIMEOUT",
      }, 504);
    }

    return json({
      error: "Unexpected recognition error.",
      code: "UNEXPECTED_RECOGNITION_ERROR",
    }, 500);
  }
});

function extractOutputText(payload: OpenAIResponse) {
  const chunks: string[] = [];

  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;

    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("");
}

function extractRefusal(payload: OpenAIResponse) {
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;

    for (const part of item.content ?? []) {
      if (part.type === "refusal" && typeof part.refusal === "string") {
        return part.refusal;
      }
    }
  }

  return "";
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
