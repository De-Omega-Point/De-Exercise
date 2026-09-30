-- De-Exercise core MVP schema.
-- Namespaced in public so it can safely coexist with the De-Movement schema
-- already deployed to the shared D-Move Supabase project.

create table if not exists public.de_exercise_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.de_exercise_gyms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location_label text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.de_exercise_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid,
  nickname text,
  equipment_type text not null,
  manufacturer text,
  model text,
  load_increment_kg numeric(8,2) not null default 2.5 check (load_increment_kg > 0),
  recognition_confidence numeric(4,3) check (recognition_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (id, user_id),
  foreign key (gym_id, user_id)
    references public.de_exercise_gyms(id, user_id)
    on delete set null
);

create table if not exists public.de_exercise_equipment_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  foreign key (equipment_id, user_id)
    references public.de_exercise_equipment(id, user_id)
    on delete cascade
);

create table if not exists public.de_exercise_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  primary_muscles text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table if not exists public.de_exercise_equipment_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid not null,
  exercise_id uuid not null,
  is_primary boolean not null default false,
  unique (equipment_id, exercise_id),
  foreign key (equipment_id, user_id)
    references public.de_exercise_equipment(id, user_id)
    on delete cascade,
  foreign key (exercise_id, user_id)
    references public.de_exercise_exercises(id, user_id)
    on delete cascade
);

create table if not exists public.de_exercise_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  unique (id, user_id),
  foreign key (gym_id, user_id)
    references public.de_exercise_gyms(id, user_id)
    on delete set null
);

create table if not exists public.de_exercise_workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null,
  equipment_id uuid,
  sequence_no integer not null default 1 check (sequence_no > 0),
  unique (id, user_id),
  foreign key (workout_id, user_id)
    references public.de_exercise_workouts(id, user_id)
    on delete cascade,
  foreign key (exercise_id, user_id)
    references public.de_exercise_exercises(id, user_id)
    on delete restrict,
  foreign key (equipment_id, user_id)
    references public.de_exercise_equipment(id, user_id)
    on delete set null
);

create table if not exists public.de_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_exercise_id uuid not null,
  set_no integer not null check (set_no > 0),
  weight_kg numeric(8,2) not null check (weight_kg >= 0),
  reps integer not null check (reps > 0 and reps <= 1000),
  rir integer check (rir between 0 and 10),
  is_warmup boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, set_no),
  foreign key (workout_exercise_id, user_id)
    references public.de_exercise_workout_exercises(id, user_id)
    on delete cascade
);

create table if not exists public.de_exercise_progression_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null,
  equipment_id uuid,
  rep_low integer not null default 8 check (rep_low > 0),
  rep_high integer not null default 12 check (rep_high >= rep_low),
  target_sets integer not null default 3 check (target_sets > 0),
  increment_kg numeric(8,2) not null default 2.5 check (increment_kg > 0),
  created_at timestamptz not null default now(),
  foreign key (exercise_id, user_id)
    references public.de_exercise_exercises(id, user_id)
    on delete cascade,
  foreign key (equipment_id, user_id)
    references public.de_exercise_equipment(id, user_id)
    on delete cascade
);

create table if not exists public.de_exercise_progression_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null,
  equipment_id uuid,
  action text not null check (action in ('increase_reps','increase_load','hold','reduce_load')),
  target_weight_kg numeric(8,2) not null check (target_weight_kg >= 0),
  target_rep_low integer not null check (target_rep_low > 0),
  target_rep_high integer not null check (target_rep_high >= target_rep_low),
  explanation text not null,
  based_on_workout_id uuid,
  created_at timestamptz not null default now(),
  foreign key (exercise_id, user_id)
    references public.de_exercise_exercises(id, user_id)
    on delete cascade,
  foreign key (equipment_id, user_id)
    references public.de_exercise_equipment(id, user_id)
    on delete cascade,
  foreign key (based_on_workout_id, user_id)
    references public.de_exercise_workouts(id, user_id)
    on delete set null
);

create table if not exists public.de_exercise_recognition_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid,
  input_storage_path text,
  equipment_type text not null,
  manufacturer text,
  model text,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  candidates jsonb not null default '[]'::jsonb,
  user_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (equipment_id, user_id)
    references public.de_exercise_equipment(id, user_id)
    on delete set null
);

create index if not exists dex_gyms_user_idx
  on public.de_exercise_gyms(user_id);
create index if not exists dex_equipment_user_idx
  on public.de_exercise_equipment(user_id);
create index if not exists dex_equipment_gym_idx
  on public.de_exercise_equipment(user_id, gym_id);
create index if not exists dex_equipment_images_user_equipment_idx
  on public.de_exercise_equipment_images(user_id, equipment_id);
create index if not exists dex_exercises_user_idx
  on public.de_exercise_exercises(user_id);
create index if not exists dex_equipment_exercises_user_idx
  on public.de_exercise_equipment_exercises(user_id);
create index if not exists dex_equipment_exercises_exercise_idx
  on public.de_exercise_equipment_exercises(user_id, exercise_id);
create index if not exists dex_workouts_user_started_idx
  on public.de_exercise_workouts(user_id, started_at desc);
create index if not exists dex_workout_exercises_workout_idx
  on public.de_exercise_workout_exercises(user_id, workout_id);
create index if not exists dex_workout_exercises_equipment_idx
  on public.de_exercise_workout_exercises(user_id, equipment_id, workout_id);
create index if not exists dex_sets_workout_exercise_idx
  on public.de_exercise_sets(user_id, workout_exercise_id, created_at);
create index if not exists dex_progression_rules_user_idx
  on public.de_exercise_progression_rules(user_id, exercise_id, equipment_id);
create index if not exists dex_progression_recs_user_idx
  on public.de_exercise_progression_recommendations(user_id, exercise_id, equipment_id, created_at desc);
create index if not exists dex_recognition_user_idx
  on public.de_exercise_recognition_events(user_id, created_at desc);

alter table public.de_exercise_profiles enable row level security;
alter table public.de_exercise_gyms enable row level security;
alter table public.de_exercise_equipment enable row level security;
alter table public.de_exercise_equipment_images enable row level security;
alter table public.de_exercise_exercises enable row level security;
alter table public.de_exercise_equipment_exercises enable row level security;
alter table public.de_exercise_workouts enable row level security;
alter table public.de_exercise_workout_exercises enable row level security;
alter table public.de_exercise_sets enable row level security;
alter table public.de_exercise_progression_rules enable row level security;
alter table public.de_exercise_progression_recommendations enable row level security;
alter table public.de_exercise_recognition_events enable row level security;

revoke all on table
  public.de_exercise_profiles,
  public.de_exercise_gyms,
  public.de_exercise_equipment,
  public.de_exercise_equipment_images,
  public.de_exercise_exercises,
  public.de_exercise_equipment_exercises,
  public.de_exercise_workouts,
  public.de_exercise_workout_exercises,
  public.de_exercise_sets,
  public.de_exercise_progression_rules,
  public.de_exercise_progression_recommendations,
  public.de_exercise_recognition_events
from anon;

grant select, insert, update, delete on table
  public.de_exercise_profiles,
  public.de_exercise_gyms,
  public.de_exercise_equipment,
  public.de_exercise_equipment_images,
  public.de_exercise_exercises,
  public.de_exercise_equipment_exercises,
  public.de_exercise_workouts,
  public.de_exercise_workout_exercises,
  public.de_exercise_sets,
  public.de_exercise_progression_rules,
  public.de_exercise_progression_recommendations,
  public.de_exercise_recognition_events
to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'de_exercise_profiles',
    'de_exercise_gyms',
    'de_exercise_equipment',
    'de_exercise_equipment_images',
    'de_exercise_exercises',
    'de_exercise_equipment_exercises',
    'de_exercise_workouts',
    'de_exercise_workout_exercises',
    'de_exercise_sets',
    'de_exercise_progression_rules',
    'de_exercise_progression_recommendations',
    'de_exercise_recognition_events'
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

-- Equipment photo storage is intentionally a later step.
-- Do not write directly to storage.objects. Create a private bucket through
-- the Storage API/dashboard, then add per-user folder RLS policies.
