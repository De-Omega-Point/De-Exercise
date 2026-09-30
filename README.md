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
- Supabase Auth, Postgres, Storage and Edge Functions
- OpenAI Responses API for equipment image understanding
- GitHub as the source of truth

## MVP

- Mobile-first equipment scan
- Confidence-aware confirmation
- Equipment library
- Workout set logging
- Exact-machine history
- Double-progression recommendations
- kg-first data model
- Strong RLS on user-owned data

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set the public Supabase values in `.env`.

Server secrets such as `OPENAI_API_KEY` belong in Supabase Edge Function secrets, never in browser environment variables.

## Repository status

Foundation work is developed on feature branches and merged through pull requests.
