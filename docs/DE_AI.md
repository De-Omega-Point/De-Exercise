# De-AI

De-AI is the De-Omega-Point intelligence stack.

For De-Exercise, De-AI is a **capability platform**, not a model name. Product code asks De-AI for a capability and De-AI decides which internal model/runtime performs the work.

## Why this shape

De-Exercise needs reliable gym-equipment identification from phone photos while keeping the app simple.

The product should not know:

- which vision model is active
- where that model is hosted
- which inference runtime serves it
- how prompts are versioned
- how confidence is calibrated
- how fallback models are selected

Those are De-AI responsibilities.

## De-AI stack for De-Exercise

### 1. Product client

De-Exercise:

- captures the machine photo
- compresses it to a practical mobile size
- sends it to the authenticated Supabase Edge Function
- renders De-AI's proposed identity
- requires user confirmation/correction when confidence is low

The client does not hold De-AI credentials.

### 2. Product orchestration

Supabase `recognise-equipment`:

- verifies the De-Exercise user JWT
- validates image type/size
- adds the De-AI capability contract
- authenticates server-to-server with De-AI
- validates the returned equipment schema
- normalises De-AI failures into product-safe error codes

Required secrets:

- `DE_AI_VISION_URL`
- `DE_AI_VISION_TOKEN`

### 3. De-AI Vision Gateway

Stable internal endpoint:

```
POST /v1/vision/equipment/identify
```

The deployed URL is supplied to De-Exercise as `DE_AI_VISION_URL`.

Headers:

```
Authorization: Bearer <DE_AI_VISION_TOKEN>
Content-Type: application/json
X-De-AI-Product: de-exercise
X-De-AI-Capability: gym-equipment-identification.v1
```

Core responsibilities:

- authenticate product requests
- select the best available vision model
- run image understanding
- enforce the response schema
- calibrate confidence
- abstain rather than hallucinate brand/model
- log latency/model/version without logging unnecessary image data
- support fallback routing without changing De-Exercise

### 4. Model router

De-AI owns an internal model registry.

The router should choose models by capability rather than exposing model names to products.

Example logical registry:

```
gym-equipment-identification.v1
  primary -> vision model A
  fallback -> vision model B
  evaluator -> calibration pipeline
```

The underlying implementation can evolve independently of De-Exercise.

### 5. Equipment intelligence

Above raw vision, De-AI should maintain gym-specific intelligence:

- equipment family taxonomy
- manufacturer/model aliases
- common exercises per machine
- primary muscle mapping
- visible distinguishing features
- supported load semantics
- confidence thresholds

This layer makes machine identification more useful than generic image captioning.

### 6. Machine memory matcher

Phase after baseline vision accuracy:

1. De-AI identifies the machine family.
2. De-Exercise supplies candidate saved machines from the user's current gym.
3. De-AI compares the new image against saved machine images/metadata.
4. De-AI returns the most likely **same physical machine** candidate.

This is the high-value path because progressive overload should compare against the exact machine whenever possible.

### 7. Evaluation + calibration

Maintain a labelled De-AI equipment test set.

Track:

- equipment-family top-1 accuracy
- candidate recall
- brand/model precision
- low-confidence catch rate
- confidence calibration
- same-machine matching accuracy
- latency p50/p95

Do not optimise only for confident answers. A correct abstention is better than a fabricated model identity.

## Capability request

De-Exercise currently sends:

```json
{
  "capability": "gym-equipment-identification.v1",
  "image": {
    "data_url": "data:image/jpeg;base64,..."
  },
  "instruction": "Identify the gym exercise equipment...",
  "response_schema": {
    "name": "de_exercise_equipment_recognition",
    "version": "1",
    "schema": {}
  },
  "metadata": {
    "product": "de-exercise",
    "purpose": "machine-identification"
  }
}
```

## Capability response

De-AI returns:

```json
{
  "equipment_type": "Plate-loaded chest press",
  "manufacturer": null,
  "model": null,
  "likely_exercises": ["Chest press"],
  "primary_muscles": ["Chest", "Triceps", "Front deltoids"],
  "confidence": 0.91,
  "distinguishing_features": [
    "Independent press arms",
    "Plate-loaded resistance"
  ],
  "notes": "Machine family is clear; manufacturer is not visible.",
  "candidate_matches": []
}
```

The gateway may also wrap this as `{"result": ...}`.

## Authority boundary

De-AI may:

- propose machine identity
- propose exercises/muscles
- return confidence/candidates
- explain visible evidence

De-AI may not silently change workout loads.

Progressive overload remains deterministic and human-configurable inside De-Exercise.
