# De-Exercise

AI-assisted gym equipment recognition and progressive-overload tracking.

## Product loop

1. Start a workout.
2. Photograph new equipment or choose a saved machine.
3. Confirm the equipment identity when AI recognition is used.
4. Save the scan photo privately as part of that exact machine's memory.
5. Load the machine's history and progression rule.
6. Log weight, reps and RIR.
7. Correct or undo mistakes from the current workout without rewriting history.
8. Keep useful workout notes.
9. Finish the workout and preserve a clean session summary.
10. Return later with the machine's photo, history, PRs, trend, notes and rule intact.

AI proposes equipment identity. It does **not** silently decide training progression.

## Stack

- React + TypeScript + Vite
- Supabase Auth, Postgres, Storage and Edge Functions
- OpenAI Responses API for equipment image understanding
- GitHub as the source of truth

## Phase 6 — Routines + Session Queue

### Saved routines

- create routines from equipment already saved in the Library
- order machines before saving
- each saved machine can appear once per routine
- machine-specific progression rules remain the single source of truth for target sets, rep ranges and load increments
- routines can be started or deleted from the Routines view

### Live routine queue

- starting a routine binds it to the workout
- the active routine survives reloads through `workouts.routine_id`
- queue progress is calculated from real working sets in the current workout
- routine items show working-set completion against each machine's target sets
- any routine machine can be loaded with one tap
- a Next Machine control advances through unfinished work

## Phase 5 — Reversible Logging + Visual Machine Memory

### Safe set correction

- sets from the active workout can be edited
- only the latest active-workout set exposes Undo
- historical sets are visible but locked in the training surface
- corrections and undo operations recalculate session totals
- progression recommendations are recalculated after every correction

### Workout notes

- notes can be saved while a workout is active
- notes persist in the workout record
- recent History surfaces the saved note

### Private equipment photos

- the photo used for recognition can be stored after the user confirms the machine
- photos live in a private Supabase Storage bucket
- object paths are scoped under the authenticated user's ID
- Storage RLS restricts upload/read/update/delete to the owning user
- the equipment library uses short-lived signed URLs for display
- bucket uploads are limited to JPEG, PNG and WebP up to 10 MB

## Earlier phases

### Phase 4 — Workout Lifecycle + Progression Control

- explicit Start / Finish Workout
- live session timer and totals
- completed workout summary
- per-machine rep range, target sets and load increment

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

The equipment photo bucket is `de-exercise-equipment` and is private.


## GitHub Pages production

Production target:

- https://de-omega-point.github.io/De-Exercise/

The Pages workflow builds on pushes to `main` with:

- `VITE_SUPABASE_URL=https://pbqxkcigkiaougkqcolq.supabase.co`
- the active Supabase publishable key
- Vite production base path `/De-Exercise/`

Email sign-up requests use the current Vite `BASE_URL` as `emailRedirectTo`, so production confirmations point back to the Pages app while local development continues to use `/`.

GitHub Pages must be enabled for this repository with **Source = GitHub Actions**. Supabase Auth must also allow the production Pages URL as a redirect URL.

## Product boundary

De-Exercise is a training log and progression tool, not a medical or injury-diagnosis system.
