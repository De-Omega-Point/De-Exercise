# recognise-equipment

Authenticated Supabase Edge Function that brokers De-Exercise machine photos to **De-AI Vision**.

## Runtime contract

Browser:

```
De-Exercise
  -> Supabase recognise-equipment
  -> De-AI Vision Gateway
```

The browser never receives De-AI service credentials.

## Secrets

Set in Supabase Edge Function Secrets:

- `DE_AI_VISION_URL` — private HTTPS endpoint for the De-AI Vision Gateway equipment-identification capability.
- `DE_AI_VISION_TOKEN` — bearer token used only by the server-side Edge Function.

No third-party model API keys belong in De-Exercise.

## Client request

```json
{
  "image_data_url": "data:image/jpeg;base64,..."
}
```

The Edge Function validates the request and sends De-AI:

- capability: `gym-equipment-identification.v1`
- compressed equipment image
- recognition instruction
- strict response schema
- product/purpose metadata

## De-AI response

The gateway should return either the recognition object directly or:

```json
{
  "result": {
    "equipment_type": "Plate-loaded chest press",
    "manufacturer": null,
    "model": null,
    "likely_exercises": ["Chest press"],
    "primary_muscles": ["Chest", "Triceps", "Front deltoids"],
    "confidence": 0.91,
    "distinguishing_features": ["Independent press arms"],
    "notes": "Machine family is clear; brand is not visible.",
    "candidate_matches": []
  }
}
```

Confidence below 0.75 requires explicit user correction/confirmation in the client.
