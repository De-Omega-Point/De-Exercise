# De-Exercise

AI-assisted gym equipment recognition and progressive-overload tracking.

## Product loop

1. Photograph a piece of gym equipment.
2. AI identifies the likely machine and exercise options.
3. The user confirms or corrects the match.
4. De-Exercise remembers that exact machine.
5. Log weight, reps and RIR during training.
6. A deterministic progression engine recommends the next target and explains why.

AI proposes equipment identity. It does **not** silently decide training progression.

## Stack

- React + TypeScript + Vite
- Supabase Auth, Postgres and Edge Functions
- OpenAI Responses API for equipment image understanding
- GitHub as the source of truth

## Phase 2

The authenticated persistence loop covers:

- account sign-in/sign-up
- namespaced De-Exercise tables inside the shared D-Move Supabase project
- saved equipment + exercise mapping
- exact-machine set history
- persisted workouts and working sets
- persisted progression recommendations
- RLS owner isolation plus same-owner composite foreign keys
- authenticated equipment-recognition Edge Function

Equipment photo Storage is intentionally deferred until the core scan/log loop is verified. The current recognition request sends the selected image directly to the authenticated Edge Function and does not persist the photo.

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set the public Supabase values in `.env`.

Server secrets such as `OPENAI_API_KEY` belong in Supabase Edge Function secrets, never in browser environment variables.

## Backend

Shared Supabase project: `D-Move`.

De-Exercise tables are prefixed with `de_exercise_` so this product can safely coexist with De-Movement in the same project.

The `recognise-equipment` function requires:

- `OPENAI_API_KEY`
- optional `OPENAI_VISION_MODEL` override (default: `gpt-6-luna`)

## Product boundary

De-Exercise is a training log and progression tool, not a medical or injury-diagnosis system.
