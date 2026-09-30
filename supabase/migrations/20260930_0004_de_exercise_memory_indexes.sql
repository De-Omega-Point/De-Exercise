-- Phase 3 read-path indexes for machine library and history views.

create index if not exists dex_equipment_user_last_used_idx
  on public.de_exercise_equipment(user_id, last_used_at desc nulls last, created_at desc);

create index if not exists dex_workouts_user_completed_idx
  on public.de_exercise_workouts(user_id, completed_at desc nulls last, started_at desc);
