-- Correct nullable composite foreign keys in the already-deployed Phase 2 schema.
-- Only the nullable relation ID should be cleared. The owner user_id must remain intact.

alter table public.de_exercise_equipment
  drop constraint if exists de_exercise_equipment_gym_id_user_id_fkey,
  add constraint de_exercise_equipment_gym_id_user_id_fkey
    foreign key (gym_id, user_id)
    references public.de_exercise_gyms(id, user_id)
    on delete set null (gym_id);

alter table public.de_exercise_workouts
  drop constraint if exists de_exercise_workouts_gym_id_user_id_fkey,
  add constraint de_exercise_workouts_gym_id_user_id_fkey
    foreign key (gym_id, user_id)
    references public.de_exercise_gyms(id, user_id)
    on delete set null (gym_id);

alter table public.de_exercise_workout_exercises
  drop constraint if exists de_exercise_workout_exercises_equipment_id_user_id_fkey,
  add constraint de_exercise_workout_exercises_equipment_id_user_id_fkey
    foreign key (equipment_id, user_id)
    references public.de_exercise_equipment(id, user_id)
    on delete set null (equipment_id);

alter table public.de_exercise_progression_recommendations
  drop constraint if exists de_exercise_progression_recomm_based_on_workout_id_user_id_fkey,
  add constraint de_exercise_progression_recomm_based_on_workout_id_user_id_fkey
    foreign key (based_on_workout_id, user_id)
    references public.de_exercise_workouts(id, user_id)
    on delete set null (based_on_workout_id);

alter table public.de_exercise_recognition_events
  drop constraint if exists de_exercise_recognition_events_equipment_id_user_id_fkey,
  add constraint de_exercise_recognition_events_equipment_id_user_id_fkey
    foreign key (equipment_id, user_id)
    references public.de_exercise_equipment(id, user_id)
    on delete set null (equipment_id);
