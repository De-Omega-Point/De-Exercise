import type {
  EquipmentLibraryItem,
  Routine,
  RoutineProgress,
  WorkoutSummary,
} from "./types";
import {
  getActiveWorkout,
  listEquipmentLibrary,
} from "./persistence";
import { supabase } from "./supabase";

const tables = {
  routines: "de_exercise_routines",
  routineItems: "de_exercise_routine_items",
  workouts: "de_exercise_workouts",
  workoutExercises: "de_exercise_workout_exercises",
  sets: "de_exercise_sets",
  progressionRules: "de_exercise_progression_rules",
} as const;

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function listRoutines(userId: string): Promise<Routine[]> {
  const { data: routineRows, error: routineError } = await client()
    .from(tables.routines)
    .select("id,name,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (routineError) throw new Error(routineError.message);
  if (!routineRows?.length) return [];

  const routineIds = routineRows.map((row) => row.id);

  const [
    equipment,
    { data: itemRows, error: itemError },
    { data: ruleRows, error: ruleError },
  ] = await Promise.all([
    listEquipmentLibrary(userId),
    client()
      .from(tables.routineItems)
      .select("id,routine_id,equipment_id,sequence_no")
      .eq("user_id", userId)
      .in("routine_id", routineIds)
      .order("sequence_no", { ascending: true }),
    client()
      .from(tables.progressionRules)
      .select("equipment_id,target_sets")
      .eq("user_id", userId),
  ]);

  if (itemError) throw new Error(itemError.message);
  if (ruleError) throw new Error(ruleError.message);

  const equipmentById = new Map(equipment.map((item) => [item.id, item]));
  const targetSetsByEquipment = new Map(
    (ruleRows ?? [])
      .filter((row) => row.equipment_id)
      .map((row) => [row.equipment_id as string, row.target_sets as number]),
  );

  return routineRows.map((routine) => ({
    id: routine.id,
    name: routine.name,
    createdAt: routine.created_at,
    updatedAt: routine.updated_at,
    items: (itemRows ?? [])
      .filter((item) => item.routine_id === routine.id)
      .map((item) => {
        const machine = equipmentById.get(item.equipment_id);
        if (!machine) return null;
        return {
          id: item.id,
          sequenceNo: item.sequence_no,
          equipment: machine,
          targetSets: targetSetsByEquipment.get(item.equipment_id) ?? 3,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  }));
}

export async function createRoutine(
  userId: string,
  name: string,
  equipment: EquipmentLibraryItem[],
): Promise<Routine> {
  const cleanName = name.trim().slice(0, 100);

  if (!cleanName) throw new Error("Give the routine a name.");
  if (!equipment.length) throw new Error("Add at least one machine to the routine.");

  const unique = new Set(equipment.map((item) => item.id));
  if (unique.size !== equipment.length) {
    throw new Error("A machine can only appear once in a routine.");
  }

  if (equipment.some((item) => !item.exerciseId)) {
    throw new Error("Every routine machine needs a linked exercise.");
  }

  const { data: routine, error: routineError } = await client()
    .from(tables.routines)
    .insert({
      user_id: userId,
      name: cleanName,
      updated_at: new Date().toISOString(),
    })
    .select("id,name,created_at,updated_at")
    .single();

  if (routineError) throw new Error(routineError.message);

  const { error: itemsError } = await client()
    .from(tables.routineItems)
    .insert(
      equipment.map((item, index) => ({
        user_id: userId,
        routine_id: routine.id,
        equipment_id: item.id,
        exercise_id: item.exerciseId,
        sequence_no: index + 1,
      })),
    );

  if (itemsError) {
    await client()
      .from(tables.routines)
      .delete()
      .eq("user_id", userId)
      .eq("id", routine.id);

    throw new Error(itemsError.message);
  }

  const routines = await listRoutines(userId);
  const created = routines.find((item) => item.id === routine.id);

  if (!created) throw new Error("Routine was created but could not be reloaded.");
  return created;
}

export async function deleteRoutine(userId: string, routineId: string) {
  const { error } = await client()
    .from(tables.routines)
    .delete()
    .eq("user_id", userId)
    .eq("id", routineId);

  if (error) throw new Error(error.message);
}

export async function startRoutineWorkout(
  userId: string,
  routineId: string,
): Promise<WorkoutSummary> {
  const { data: existing, error: existingError } = await client()
    .from(tables.workouts)
    .select("id,routine_id")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing) {
    if (existing.routine_id === routineId) {
      const workout = await getActiveWorkout(userId);
      if (!workout) throw new Error("Could not reload the active routine workout.");
      return workout;
    }

    throw new Error("Finish the active workout before starting another routine.");
  }

  const { error } = await client()
    .from(tables.workouts)
    .insert({
      user_id: userId,
      routine_id: routineId,
    });

  if (error) throw new Error(error.message);

  const workout = await getActiveWorkout(userId);
  if (!workout) throw new Error("Routine workout started but could not be reloaded.");
  return workout;
}

export async function getActiveRoutineId(userId: string): Promise<string | null> {
  const { data, error } = await client()
    .from(tables.workouts)
    .select("routine_id")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.routine_id ?? null;
}

export async function getRoutineProgress(
  userId: string,
  workoutId: string,
  routine: Routine,
): Promise<RoutineProgress> {
  if (!routine.items.length) return {};

  const equipmentIds = routine.items.map((item) => item.equipment.id);

  const { data: workoutExerciseRows, error: exerciseError } = await client()
    .from(tables.workoutExercises)
    .select("id,equipment_id")
    .eq("user_id", userId)
    .eq("workout_id", workoutId)
    .in("equipment_id", equipmentIds);

  if (exerciseError) throw new Error(exerciseError.message);
  if (!workoutExerciseRows?.length) return {};

  const workoutExerciseIds = workoutExerciseRows.map((row) => row.id);
  const equipmentByWorkoutExercise = new Map(
    workoutExerciseRows.map((row) => [row.id, row.equipment_id as string]),
  );

  const { data: setRows, error: setError } = await client()
    .from(tables.sets)
    .select("workout_exercise_id,is_warmup")
    .eq("user_id", userId)
    .in("workout_exercise_id", workoutExerciseIds);

  if (setError) throw new Error(setError.message);

  const progress: RoutineProgress = {};

  for (const row of setRows ?? []) {
    if (row.is_warmup) continue;
    const equipmentId = equipmentByWorkoutExercise.get(row.workout_exercise_id);
    if (!equipmentId) continue;
    progress[equipmentId] = (progress[equipmentId] ?? 0) + 1;
  }

  return progress;
}
