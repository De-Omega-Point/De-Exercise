# De-Exercise

AI-assisted gym equipment recognition and progressive-overload tracking.

## Product loop

1. Start a workout.
2. Photograph new equipment or choose a saved machine.
3. Confirm the equipment identity when AI recognition is used.
4. Load that exact machine's history and progression rule.
5. Log weight, reps and RIR.
6. The deterministic progression engine updates the next target.
7. Finish the workout and preserve a clean session summary.
8. Return later with the machine's history, PRs, trend and rule intact.

AI proposes equipment identity. It does **not** silently decide training progression.

## Stack

- React + TypeScript + Vite
- Supabase Auth, Postgres and Edge Functions
- OpenAI Responses API for equipment image understanding
- GitHub as the source of truth

## Phase 4 — Workout Lifecycle + Progression Control

### Explicit workout sessions

- Start Workout creates or resumes one open workout.
- Working sets require an active workout.
- Finish Workout writes `completed_at`.
- The completed session shows duration, exercise count, working sets, volume and top set.
- Closed workouts remain in History and are not reused for future sets.

### Machine-specific progression rules

Each exact machine/exercise pairing can store:

- minimum reps
- maximum reps
- target working sets
- load increment in kilograms

The progression engine remains deterministic and explainable. Editing a rule changes the inputs to the same transparent algorithm rather than handing authority to a generative model.

## Earlier phases

### Phase 3 — Machine Memory

- Train / Library / History navigation
- saved equipment library
- machine nicknames
- exact-machine history
- best load and estimated 1RM
- recent strength trends
- recent workout summaries

### Phase 2 — Persistence

- Supabase Auth
- namespaced `de_exercise_*` tables
- RLS user isolation
- persisted equipment, workouts, sets and progression recommendations
- authenticated `recognise-equipment` Edge Function

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

## Product boundary

De-Exercise is a training log and progression tool, not a medical or injury-diagnosis system.
