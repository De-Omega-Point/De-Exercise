-- Phase 4: make machine-specific progression rules safe to upsert.

alter table public.de_exercise_progression_rules
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists dex_progression_rules_unique_machine_idx
  on public.de_exercise_progression_rules(user_id, exercise_id, equipment_id)
  nulls not distinct;
