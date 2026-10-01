# Architecture

## Product boundary

De-Exercise has two intelligence layers with different authority.

### 1. Recognition intelligence

**De-AI Vision** analyses user-supplied equipment photos and returns a constrained equipment description with confidence and candidate matches.

The result is advisory. The user confirms or corrects uncertain identity before the machine is saved.

### 2. Progression intelligence

Progression is deterministic and auditable.

The engine uses:
- exact equipment identity
- recent working sets
- load
- reps
- RIR
- configured rep range
- equipment load increment

De-AI is not allowed to silently increase training load.

## Runtime

### Browser

React/TypeScript handles:
- camera-friendly image input
- mobile image compression
- equipment confirmation
- workout logging
- history UI
- progression explanations

Only Supabase publishable credentials are exposed to the browser.

### Supabase

Supabase provides:
- authentication
- Postgres persistence
- private equipment-image storage
- RLS authorization
- authenticated `recognise-equipment` orchestration

The Edge Function does not contain a vendor-specific model client. It validates the request and brokers it to De-AI.

### De-AI

De-AI is the De-Omega-Point intelligence stack.

For De-Exercise, the relevant capability is:

`gym-equipment-identification.v1`

The De-AI Vision Gateway owns:
- model selection/routing
- image understanding
- structured response enforcement
- confidence calibration
- failure/fallback handling
- gym-equipment taxonomy
- future same-physical-machine matching

De-Exercise connects using server-only Supabase secrets:

- `DE_AI_VISION_URL`
- `DE_AI_VISION_TOKEN`

No model-provider credential is exposed to De-Exercise or its browser client.

## Core workflow

```
photo
  ↓
browser compression
  ↓
recognise-equipment Edge Function
  ↓
De-AI Vision Gateway
  ↓
structured match + confidence
  ↓
user confirm/correct
  ↓
equipment record
  ↓
workout sets
  ↓
deterministic progression engine
  ↓
next target + explanation
```

## Confidence rule

- confidence >= 0.75: allow confirmation
- confidence < 0.75: require explicit correction/candidate selection
- unrelated or unusable image: return unknown/low confidence

## Future exact-machine matching

For maximum progressive-overload fidelity:

1. De-AI identifies the machine family.
2. De-Exercise supplies candidate saved machines from the user's current gym.
3. De-AI compares current image evidence against saved photos/metadata.
4. De-AI proposes the most likely same physical machine.
5. The user confirms before the machine history is loaded.

## Security

- RLS enabled on every exposed user-owned table.
- Ownership is keyed to `auth.uid()`.
- Update policies use both `USING` and `WITH CHECK`.
- User-id policy columns are indexed.
- Equipment images live in a private bucket under a per-user folder.
- De-AI credentials remain server-side in Supabase Edge Function Secrets.
- The browser never receives De-AI gateway tokens or model-runtime credentials.
