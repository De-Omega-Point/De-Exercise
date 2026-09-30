-- Phase 6: saved routines and routine-aware workouts.

create table if not exists public.de_exercise_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.de_exercise_routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null,
  equipment_id uuid not null,
  exercise_id uuid not null,
  sequence_no integer not null check (sequence_no > 0),
  created_at timestamptz not null default now(),
  unique (routine_id, sequence_no),
  unique (routine_id, equipment_id),
  foreign key (routine_id, user_id)
    references public.de_exercise_routines(id, user_id)
    on delete cascade,
  foreign key (equipment_id, user_id)
    references public.de_exercise_equipment(id, user_id)
    on delete cascade,
  foreign key (exercise_id, user_id)
    references public.de_exercise_exercises(id, user_id)
    on delete restrict
);

alter table public.de_exercise_workouts
  add column if not exists routine_id uuid;

alter table public.de_exercise_workouts
  drop constraint if exists de_exercise_workouts_routine_id_user_id_fkey,
  add constraint de_exercise_workouts_routine_id_user_id_fkey
    foreign key (routine_id, user_id)
    references public.de_exercise_routines(id, user_id)
    on delete set null (routine_id);

create index if not exists dex_routines_user_updated_idx
  on public.de_exercise_routines(user_id, updated_at desc);

create index if not exists dex_routine_items_routine_idx
  on public.de_exercise_routine_items(routine_id, user_id, sequence_no);

create index if not exists dex_routine_items_equipment_fk_idx
  on public.de_exercise_routine_items(equipment_id, user_id);

create index if not exists dex_routine_items_exercise_fk_idx
  on public.de_exercise_routine_items(exercise_id, user_id);

create index if not exists dex_workouts_routine_fk_idx
  on public.de_exercise_workouts(routine_id, user_id);

alter table public.de_exercise_routines enable row level security;
alter table public.de_exercise_routine_items enable row level security;

revoke all on table
  public.de_exercise_routines,
  public.de_exercise_routine_items
from anon;

grant select, insert, update, delete on table
  public.de_exercise_routines,
  public.de_exercise_routine_items
to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'de_exercise_routines',
    'de_exercise_routine_items'
  ]
  loop
    execute format('drop policy if exists "dex owner select" on public.%I', t);
    execute format('drop policy if exists "dex owner insert" on public.%I', t);
    execute format('drop policy if exists "dex owner update" on public.%I', t);
    execute format('drop policy if exists "dex owner delete" on public.%I', t);

    execute format(
      'create policy "dex owner select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "dex owner insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "dex owner update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "dex owner delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end $$;
