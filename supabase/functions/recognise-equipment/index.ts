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
    "candidate_matches"
  ],
  additionalProperties: false,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await req.json() as RecognitionRequest;
    const imageDataUrl = body.image_data_url;

    if (!imageDataUrl || !/^data:image\/(jpeg|png|webp);base64,/.test(imageDataUrl)) {
      return json({ error: "A JPEG, PNG or WebP image_data_url is required." }, 400);
    }

    if (imageDataUrl.length > 14_000_000) {
      return json({ error: "Image is too large. Compress it before recognition." }, 413);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return json({ error: "Recognition service is not configured." }, 503);
    }

    const model = Deno.env.get("OPENAI_VISION_MODEL") || "gpt-6-luna";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
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
                  "Identify the gym exercise equipment in this image.",
                  "Return evidence-based identification only.",
                  "Do not guess a manufacturer or model without visible evidence.",
                  "If the image is unclear, unrelated, or multiple machine types are plausible, lower confidence and include candidate_matches.",
                  "If it is not exercise equipment, use equipment_type 'unknown', confidence 0, empty exercise and muscle arrays, and explain why in notes."
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
      return json({ error: "Equipment recognition failed." }, 502);
    }

    const payload = await response.json() as OpenAIResponse;
    const refusal = extractRefusal(payload);

    if (refusal) {
      return json({ error: "Recognition request was refused.", detail: refusal }, 422);
    }

    const outputText = extractOutputText(payload);

    if (!outputText) {
      return json({ error: "Recognition response was incomplete." }, 502);
    }

    const result = JSON.parse(outputText);

    if (typeof result.confidence !== "number") {
      return json({ error: "Recognition response was invalid." }, 502);
    }

    return json(result, 200);
  } catch (error) {
    console.error(error);
    return json({ error: "Unexpected recognition error." }, 500);
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
