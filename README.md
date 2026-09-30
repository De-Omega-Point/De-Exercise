# De-Exercise

AI-assisted gym equipment recognition and progressive-overload tracking.

## Product loop

1. Photograph a piece of gym equipment.
2. AI identifies the likely machine and exercise options.
3. The user confirms or corrects the match.
4. De-Exercise remembers that exact machine.
5. Log weight, reps and RIR during training.
6. A deterministic progression engine recommends the next target and explains why.
7. Reuse the saved machine later with its exact history, PRs and trend already loaded.

AI proposes equipment identity. It does **not** silently decide training progression.

## Stack

- React + TypeScript + Vite
- Supabase Auth, Postgres and Edge Functions
- OpenAI Responses API for equipment image understanding
- GitHub as the source of truth

## Phase 3 — Machine Memory

The app now has three primary surfaces:

### Train

- scan and confirm new equipment
- choose an existing saved machine
- load exact-machine working-set history
- log weight, reps and RIR
- persist progression recommendations

### Library

- browse saved equipment
- nickname machines for easy recognition in a real gym
- see last set, best load and estimated 1RM
- see a lightweight recent-strength trend
- jump directly into training on that exact machine

### History

- recent workouts
- working-set count
- workout volume
- exercise count
- top set for each workout

The memory views are calculated from user-owned De-Exercise tables and remain protected by the Phase 2 RLS model.

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
- optional `OPENAI_VISION_MODEL` override

## Product boundary

De-Exercise is a training log and progression tool, not a medical or injury-diagnosis system.
