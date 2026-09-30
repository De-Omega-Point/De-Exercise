# Architecture

## Product boundary

De-Exercise has two intelligence layers with different authority.

### 1. Recognition intelligence

A vision-capable model analyses user-supplied equipment photos and returns a constrained equipment description with confidence and candidate matches.

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

The model is not allowed to silently increase training load.

## Runtime

### Browser

React/TypeScript handles:
- camera-friendly image input
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
- Edge Function for server-side equipment recognition

### OpenAI

The Edge Function sends the equipment image to the OpenAI Responses API using image input and Structured Outputs.

The OpenAI API key exists only as a server-side Edge Function secret.

## Core workflow

```
photo
  ↓
private upload / image input
  ↓
recognise-equipment Edge Function
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

## Security

- RLS enabled on every exposed user-owned table.
- Ownership is keyed to `auth.uid()`.
- Update policies use both `USING` and `WITH CHECK`.
- User-id policy columns are indexed.
- Equipment images live in a private bucket under a per-user folder.
- No service-role or OpenAI secrets are shipped to the browser.
