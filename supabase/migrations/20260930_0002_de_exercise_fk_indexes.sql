-- Cover composite foreign keys in their declared column order.
-- This satisfies Supabase's FK index advisor and speeds parent-row updates/deletes.

create index if not exists dex_equipment_gym_fk_idx
  on public.de_exercise_equipment(gym_id, user_id);

create index if not exists dex_equipment_images_equipment_fk_idx
  on public.de_exercise_equipment_images(equipment_id, user_id);

create index if not exists dex_equipment_exercises_equipment_fk_idx
  on public.de_exercise_equipment_exercises(equipment_id, user_id);

create index if not exists dex_equipment_exercises_exercise_fk_idx
  on public.de_exercise_equipment_exercises(exercise_id, user_id);

create index if not exists dex_workouts_gym_fk_idx
  on public.de_exercise_workouts(gym_id, user_id);

create index if not exists dex_workout_exercises_workout_fk_idx
  on public.de_exercise_workout_exercises(workout_id, user_id);

create index if not exists dex_workout_exercises_exercise_fk_idx
  on public.de_exercise_workout_exercises(exercise_id, user_id);

create index if not exists dex_workout_exercises_equipment_fk_idx
  on public.de_exercise_workout_exercises(equipment_id, user_id);

create index if not exists dex_sets_workout_exercise_fk_idx
  on public.de_exercise_sets(workout_exercise_id, user_id);

create index if not exists dex_progression_rules_exercise_fk_idx
  on public.de_exercise_progression_rules(exercise_id, user_id);

create index if not exists dex_progression_rules_equipment_fk_idx
  on public.de_exercise_progression_rules(equipment_id, user_id);

create index if not exists dex_progression_recs_exercise_fk_idx
  on public.de_exercise_progression_recommendations(exercise_id, user_id);

create index if not exists dex_progression_recs_equipment_fk_idx
  on public.de_exercise_progression_recommendations(equipment_id, user_id);

create index if not exists dex_progression_recs_workout_fk_idx
  on public.de_exercise_progression_recommendations(based_on_workout_id, user_id);

create index if not exists dex_recognition_equipment_fk_idx
  on public.de_exercise_recognition_events(equipment_id, user_id);
