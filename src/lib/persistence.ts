import type { EquipmentRecognition, ProgressionRecommendation, SavedEquipment, TrainingSet } from "./types";
import { supabase } from "./supabase";

const tables = {
  profiles: "de_exercise_profiles",
  equipment: "de_exercise_equipment",
  exercises: "de_exercise_exercises",
  equipmentExercises: "de_exercise_equipment_exercises",
  workouts: "de_exercise_workouts",
  workoutExercises: "de_exercise_workout_exercises",
  sets: "de_exercise_sets",
  recommendations: "de_exercise_progression_recommendations",
  recognitionEvents: "de_exercise_recognition_events",
} as const;

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function ensureExerciseProfile(userId: string) {
  const { error } = await client()
    .from(tables.profiles)
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
}

export async function saveRecognisedEquipment(
  userId: string,
  recognition: EquipmentRecognition,
  confirmedEquipmentType?: string,
): Promise<SavedEquipment> {
  const equipmentType = (confirmedEquipmentType || recognition.equipment_type).trim();
  const exerciseName = recognition.likely_exercises[0]?.trim() || equipmentType;

  const { data: exercise, error: exerciseError } = await client()
    .from(tables.exercises)
    .upsert(
      {
        user_id: userId,
        name: exerciseName,
        primary_muscles: recognition.primary_muscles,
      },
      { onConflict: "user_id,name" },
    )
    .select("id,name")
    .single();

  if (exerciseError) throw new Error(exerciseError.message);

  const { data: equipment, error: equipmentError } = await client()
    .from(tables.equipment)
    .insert({
      user_id: userId,
      equipment_type: equipmentType,
      manufacturer: recognition.manufacturer,
      model: recognition.model,
      recognition_confidence: recognition.confidence,
      load_increment_kg: 2.5,
    })
    .select("id,equipment_type,manufacturer,model,load_increment_kg")
    .single();

  if (equipmentError) throw new Error(equipmentError.message);

  const { error: linkError } = await client()
    .from(tables.equipmentExercises)
    .insert({
      user_id: userId,
      equipment_id: equipment.id,
      exercise_id: exercise.id,
      is_primary: true,
    });

  if (linkError) throw new Error(linkError.message);

  const { error: recognitionError } = await client()
    .from(tables.recognitionEvents)
    .insert({
      user_id: userId,
      equipment_id: equipment.id,
      equipment_type: equipmentType,
      manufacturer: recognition.manufacturer,
      model: recognition.model,
      confidence: recognition.confidence,
      candidates: recognition.candidate_matches,
      user_confirmed: true,
    });

  if (recognitionError) throw new Error(recognitionError.message);

  return {
    id: equipment.id,
    equipmentType: equipment.equipment_type,
    manufacturer: equipment.manufacturer,
    model: equipment.model,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    loadIncrementKg: Number(equipment.load_increment_kg),
  };
}

export async function loadRecentSets(
  userId: string,
  equipmentId: string,
  limit = 12,
): Promise<TrainingSet[]> {
  const { data: exerciseRows, error: exerciseError } = await client()
    .from(tables.workoutExercises)
    .select("id")
    .eq("user_id", userId)
    .eq("equipment_id", equipmentId)
    .limit(100);

  if (exerciseError) throw new Error(exerciseError.message);
  const ids = (exerciseRows ?? []).map((row) => row.id);

  if (ids.length === 0) return [];

  const { data, error } = await client()
    .from(tables.sets)
    .select("id,weight_kg,reps,rir,created_at")
    .eq("user_id", userId)
    .in("workout_exercise_id", ids)
    .eq("is_warmup", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      weightKg: Number(row.weight_kg),
      reps: row.reps,
      rir: row.rir ?? 0,
      createdAt: row.created_at,
    }))
    .reverse();
}

export async function logTrainingSet(
  userId: string,
  equipment: SavedEquipment,
  values: Omit<TrainingSet, "id" | "createdAt">,
) {
  const workoutId = await ensureActiveWorkout(userId);
  const workoutExerciseId = await ensureWorkoutExercise(
    userId,
    workoutId,
    equipment.exerciseId,
    equipment.id,
  );

  const { data: lastSet, error: lastSetError } = await client()
    .from(tables.sets)
    .select("set_no")
    .eq("user_id", userId)
    .eq("workout_exercise_id", workoutExerciseId)
    .order("set_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSetError) throw new Error(lastSetError.message);
  const setNo = (lastSet?.set_no ?? 0) + 1;

  const { data, error } = await client()
    .from(tables.sets)
    .insert({
      user_id: userId,
      workout_exercise_id: workoutExerciseId,
      set_no: setNo,
      weight_kg: values.weightKg,
      reps: values.reps,
      rir: values.rir,
      is_warmup: false,
    })
    .select("id,weight_kg,reps,rir,created_at")
    .single();

  if (error) throw new Error(error.message);

  const { error: equipmentError } = await client()
    .from(tables.equipment)
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", equipment.id);

  if (equipmentError) throw new Error(equipmentError.message);

  return {
    workoutId,
    set: {
      id: data.id,
      weightKg: Number(data.weight_kg),
      reps: data.reps,
      rir: data.rir ?? 0,
      createdAt: data.created_at,
    } satisfies TrainingSet,
  };
}

export async function saveProgressionRecommendation(
  userId: string,
  equipment: SavedEquipment,
  recommendation: ProgressionRecommendation,
  workoutId: string,
) {
  const { error } = await client()
    .from(tables.recommendations)
    .insert({
      user_id: userId,
      exercise_id: equipment.exerciseId,
      equipment_id: equipment.id,
      action: recommendation.action,
      target_weight_kg: recommendation.targetWeightKg,
      target_rep_low: recommendation.targetRepLow,
      target_rep_high: recommendation.targetRepHigh,
      explanation: recommendation.explanation,
      based_on_workout_id: workoutId,
    });

  if (error) throw new Error(error.message);
}

async function ensureActiveWorkout(userId: string) {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data: existing, error: existingError } = await client()
    .from(tables.workouts)
    .select("id")
    .eq("user_id", userId)
    .is("completed_at", null)
    .gte("started_at", cutoff)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing.id;

  const { data, error } = await client()
    .from(tables.workouts)
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

async function ensureWorkoutExercise(
  userId: string,
  workoutId: string,
  exerciseId: string,
  equipmentId: string,
) {
  const { data: existing, error: existingError } = await client()
    .from(tables.workoutExercises)
    .select("id")
    .eq("user_id", userId)
    .eq("workout_id", workoutId)
    .eq("exercise_id", exerciseId)
    .eq("equipment_id", equipmentId)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing.id;

  const { count, error: countError } = await client()
    .from(tables.workoutExercises)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workout_id", workoutId);

  if (countError) throw new Error(countError.message);

  const { data, error } = await client()
    .from(tables.workoutExercises)
    .insert({
      user_id: userId,
      workout_id: workoutId,
      exercise_id: exerciseId,
      equipment_id: equipmentId,
      sequence_no: (count ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}
