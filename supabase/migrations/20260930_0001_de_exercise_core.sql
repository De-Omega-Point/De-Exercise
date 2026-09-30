-- De-Exercise core MVP schema.
-- Apply through the normal Supabase migration workflow after review.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete set null,
  nickname text,
  equipment_type text not null,
  manufacturer text,
  model text,
  load_increment_kg numeric(8,2) not null default 2.5 check (load_increment_kg > 0),
  recognition_confidence numeric(4,3) check (recognition_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.equipment_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  primary_muscles text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.equipment_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  is_primary boolean not null default false,
  unique (equipment_id, exercise_id)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  equipment_id uuid references public.equipment(id) on delete set null,
  sequence_no integer not null default 1 check (sequence_no > 0)
);

create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_no integer not null check (set_no > 0),
  weight_kg numeric(8,2) not null check (weight_kg >= 0),
  reps integer not null check (reps > 0 and reps <= 1000),
  rir integer check (rir between 0 and 10),
  is_warmup boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, set_no)
);

create table if not exists public.progression_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete cascade,
  rep_low integer not null default 8 check (rep_low > 0),
  rep_high integer not null default 12 check (rep_high >= rep_low),
  target_sets integer not null default 3 check (target_sets > 0),
  increment_kg numeric(8,2) not null default 2.5 check (increment_kg > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.progression_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete cascade,
  action text not null check (action in ('increase_reps','increase_load','hold','reduce_load')),
  target_weight_kg numeric(8,2) not null check (target_weight_kg >= 0),
  target_rep_low integer not null check (target_rep_low > 0),
  target_rep_high integer not null check (target_rep_high >= target_rep_low),
  explanation text not null,
  based_on_workout_id uuid references public.workouts(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.recognition_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete set null,
  input_storage_path text,
  equipment_type text not null,
  manufacturer text,
  model text,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  candidates jsonb not null default '[]'::jsonb,
  user_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists gyms_user_id_idx on public.gyms(user_id);
create index if not exists equipment_user_id_idx on public.equipment(user_id);
create index if not exists equipment_images_user_id_idx on public.equipment_images(user_id);
create index if not exists exercises_user_id_idx on public.exercises(user_id);
create index if not exists equipment_exercises_user_id_idx on public.equipment_exercises(user_id);
create index if not exists workouts_user_id_idx on public.workouts(user_id);
create index if not exists workout_exercises_user_id_idx on public.workout_exercises(user_id);
create index if not exists sets_user_id_idx on public.sets(user_id);
create index if not exists progression_rules_user_id_idx on public.progression_rules(user_id);
create index if not exists progression_recommendations_user_id_idx on public.progression_recommendations(user_id);
create index if not exists recognition_events_user_id_idx on public.recognition_events(user_id);
create index if not exists equipment_history_idx on public.workout_exercises(user_id, equipment_id, workout_id);

alter table public.profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_images enable row level security;
alter table public.exercises enable row level security;
alter table public.equipment_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets enable row level security;
alter table public.progression_rules enable row level security;
alter table public.progression_recommendations enable row level security;
alter table public.recognition_events enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','gyms','equipment','equipment_images','exercises',
    'equipment_exercises','workouts','workout_exercises','sets',
    'progression_rules','progression_recommendations','recognition_events'
  ]
  loop
    execute format('drop policy if exists "owner select" on public.%I', t);
    execute format('drop policy if exists "owner insert" on public.%I', t);
    execute format('drop policy if exists "owner update" on public.%I', t);
    execute format('drop policy if exists "owner delete" on public.%I', t);

    execute format(
      'create policy "owner select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "owner insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "owner update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "owner delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end $$;

-- Private Storage bucket "equipment-images" should be created through the
-- Supabase Storage API/dashboard. Store objects under:
--   <auth.uid()>/<uuid>.<ext>
--
-- Then apply policies like:
--
-- create policy "equipment image insert"
-- on storage.objects for insert to authenticated
-- with check (
--   bucket_id = 'equipment-images'
--   and (storage.foldername(name))[1] = (select auth.uid())::text
-- );
--
-- create policy "equipment image select"
-- on storage.objects for select to authenticated
-- using (
--   bucket_id = 'equipment-images'
--   and owner_id = (select auth.uid())::text
-- );
--
-- create policy "equipment image delete"
-- on storage.objects for delete to authenticated
-- using (
--   bucket_id = 'equipment-images'
--   and owner_id = (select auth.uid())::text
-- );
