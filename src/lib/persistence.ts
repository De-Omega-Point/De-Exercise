import type {
  EquipmentLibraryItem,
  EquipmentRecognition,
  ProgressionRecommendation,
  ProgressionRule,
  SavedEquipment,
  TrainingSet,
  WorkoutSummary,
} from "./types";
import { supabase } from "./supabase";

const tables = {
  profiles: "de_exercise_profiles",
  equipment: "de_exercise_equipment",
  exercises: "de_exercise_exercises",
  equipmentExercises: "de_exercise_equipment_exercises",
  workouts: "de_exercise_workouts",
  workoutExercises: "de_exercise_workout_exercises",
  sets: "de_exercise_sets",
  progressionRules: "de_exercise_progression_rules",
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

  const { error: ruleError } = await client()
    .from(tables.progressionRules)
    .upsert(
      {
        user_id: userId,
        equipment_id: equipment.id,
        exercise_id: exercise.id,
        rep_low: 8,
        rep_high: 12,
        target_sets: 3,
        increment_kg: 2.5,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,exercise_id,equipment_id" },
    );

  if (ruleError) throw new Error(ruleError.message);

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

export async function listEquipmentLibrary(userId: string): Promise<EquipmentLibraryItem[]> {
  const { data: equipmentRows, error: equipmentError } = await client()
    .from(tables.equipment)
    .select("id,nickname,equipment_type,manufacturer,model,load_increment_kg,last_used_at,created_at")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (equipmentError) throw new Error(equipmentError.message);
  if (!equipmentRows?.length) return [];

  const equipmentIds = equipmentRows.map((row) => row.id);

  const { data: linkRows, error: linkError } = await client()
    .from(tables.equipmentExercises)
    .select("equipment_id,exercise_id,is_primary")
    .eq("user_id", userId)
    .in("equipment_id", equipmentIds)
    .order("is_primary", { ascending: false });

  if (linkError) throw new Error(linkError.message);

  const exerciseIds = Array.from(new Set((linkRows ?? []).map((row) => row.exercise_id)));

  const { data: exerciseRows, error: exerciseError } = exerciseIds.length
    ? await client()
        .from(tables.exercises)
        .select("id,name")
        .eq("user_id", userId)
        .in("id", exerciseIds)
    : { data: [], error: null };

  if (exerciseError) throw new Error(exerciseError.message);

  const exerciseById = new Map((exerciseRows ?? []).map((row) => [row.id, row.name]));
  const primaryExerciseByEquipment = new Map<string, { id: string; name: string }>();

  for (const link of linkRows ?? []) {
    if (primaryExerciseByEquipment.has(link.equipment_id)) continue;
    primaryExerciseByEquipment.set(link.equipment_id, {
      id: link.exercise_id,
      name: exerciseById.get(link.exercise_id) ?? "Exercise",
    });
  }

  const { data: workoutExerciseRows, error: workoutExerciseError } = await client()
    .from(tables.workoutExercises)
    .select("id,equipment_id")
    .eq("user_id", userId)
    .in("equipment_id", equipmentIds)
    .limit(1000);

  if (workoutExerciseError) throw new Error(workoutExerciseError.message);

  const workoutExerciseIds = (workoutExerciseRows ?? []).map((row) => row.id);
  const equipmentByWorkoutExercise = new Map(
    (workoutExerciseRows ?? []).map((row) => [row.id, row.equipment_id as string]),
  );

  const { data: setRows, error: setError } = workoutExerciseIds.length
    ? await client()
        .from(tables.sets)
        .select("id,workout_exercise_id,weight_kg,reps,rir,created_at")
        .eq("user_id", userId)
        .in("workout_exercise_id", workoutExerciseIds)
        .eq("is_warmup", false)
        .order("created_at", { ascending: false })
        .limit(1000)
    : { data: [], error: null };

  if (setError) throw new Error(setError.message);

  const setsByEquipment = new Map<string, TrainingSet[]>();

  for (const row of setRows ?? []) {
    const equipmentId = equipmentByWorkoutExercise.get(row.workout_exercise_id);
    if (!equipmentId) continue;
    const list = setsByEquipment.get(equipmentId) ?? [];
    list.push({
      id: row.id,
      weightKg: Number(row.weight_kg),
      reps: row.reps,
      rir: row.rir ?? 0,
      createdAt: row.created_at,
    });
    setsByEquipment.set(equipmentId, list);
  }

  return equipmentRows.map((row) => {
    const exercise = primaryExerciseByEquipment.get(row.id) ?? {
      id: "",
      name: row.equipment_type,
    };
    const newestFirst = setsByEquipment.get(row.id) ?? [];
    const chronological = [...newestFirst].reverse();
    const estimated = chronological.map(estimated1Rm);
    const bestWeightKg = chronological.reduce((max, set) => Math.max(max, set.weightKg), 0);

    return {
      id: row.id,
      nickname: row.nickname,
      equipmentType: row.equipment_type,
      manufacturer: row.manufacturer,
      model: row.model,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      loadIncrementKg: Number(row.load_increment_kg),
      lastUsedAt: row.last_used_at,
      lastSet: newestFirst[0] ?? null,
      bestWeightKg,
      estimated1RmKg: estimated.length ? Math.max(...estimated) : 0,
      totalWorkingSets: chronological.length,
      trend1RmKg: estimated.slice(-12),
    };
  });
}

export async function renameEquipment(userId: string, equipmentId: string, nickname: string) {
  const clean = nickname.trim();

  const { error } = await client()
    .from(tables.equipment)
    .update({ nickname: clean || null })
    .eq("user_id", userId)
    .eq("id", equipmentId);

  if (error) throw new Error(error.message);
}

export async function getActiveWorkout(userId: string): Promise<WorkoutSummary | null> {
  const { data, error } = await client()
    .from(tables.workouts)
    .select("id,started_at,completed_at")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const summaries = await summariseWorkoutRows(userId, [data]);
  return summaries[0] ?? {
    id: data.id,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    exerciseCount: 0,
    workingSets: 0,
    volumeKg: 0,
    topSet: null,
  };
}

export async function startWorkout(userId: string): Promise<WorkoutSummary> {
  const existing = await getActiveWorkout(userId);
  if (existing) return existing;

  const { data, error } = await client()
    .from(tables.workouts)
    .insert({ user_id: userId })
    .select("id,started_at,completed_at")
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    exerciseCount: 0,
    workingSets: 0,
    volumeKg: 0,
    topSet: null,
  };
}

export async function finishWorkout(userId: string, workoutId: string): Promise<WorkoutSummary> {
  const completedAt = new Date().toISOString();

  const { data, error } = await client()
    .from(tables.workouts)
    .update({ completed_at: completedAt })
    .eq("user_id", userId)
    .eq("id", workoutId)
    .is("completed_at", null)
    .select("id,started_at,completed_at")
    .single();

  if (error) throw new Error(error.message);

  const summaries = await summariseWorkoutRows(userId, [data]);
  return summaries[0] ?? {
    id: data.id,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    exerciseCount: 0,
    workingSets: 0,
    volumeKg: 0,
    topSet: null,
  };
}

export async function listRecentWorkouts(userId: string, limit = 12): Promise<WorkoutSummary[]> {
  const { data: workoutRows, error: workoutError } = await client()
    .from(tables.workouts)
    .select("id,started_at,completed_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (workoutError) throw new Error(workoutError.message);
  if (!workoutRows?.length) return [];

  return summariseWorkoutRows(userId, workoutRows);
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

export async function loadProgressionRule(
  userId: string,
  equipment: SavedEquipment,
): Promise<ProgressionRule> {
  const { data, error } = await client()
    .from(tables.progressionRules)
    .select("rep_low,rep_high,target_sets,increment_kg")
    .eq("user_id", userId)
    .eq("exercise_id", equipment.exerciseId)
    .eq("equipment_id", equipment.id)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data
    ? {
        repLow: data.rep_low,
        repHigh: data.rep_high,
        targetSets: data.target_sets,
        incrementKg: Number(data.increment_kg),
      }
    : {
        repLow: 8,
        repHigh: 12,
        targetSets: 3,
        incrementKg: equipment.loadIncrementKg || 2.5,
      };
}

export async function saveProgressionRule(
  userId: string,
  equipment: SavedEquipment,
  rule: ProgressionRule,
): Promise<ProgressionRule> {
  const clean = normaliseProgressionRule(rule);

  const { error } = await client()
    .from(tables.progressionRules)
    .upsert(
      {
        user_id: userId,
        exercise_id: equipment.exerciseId,
        equipment_id: equipment.id,
        rep_low: clean.repLow,
        rep_high: clean.repHigh,
        target_sets: clean.targetSets,
        increment_kg: clean.incrementKg,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,exercise_id,equipment_id" },
    );

  if (error) throw new Error(error.message);

  const { error: equipmentError } = await client()
    .from(tables.equipment)
    .update({ load_increment_kg: clean.incrementKg })
    .eq("user_id", userId)
    .eq("id", equipment.id);

  if (equipmentError) throw new Error(equipmentError.message);

  return clean;
}

export async function logTrainingSet(
  userId: string,
  workoutId: string,
  equipment: SavedEquipment,
  values: Omit<TrainingSet, "id" | "createdAt">,
) {
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

async function summariseWorkoutRows(
  userId: string,
  workoutRows: Array<{ id: string; started_at: string; completed_at: string | null }>,
): Promise<WorkoutSummary[]> {
  if (!workoutRows.length) return [];

  const workoutIds = workoutRows.map((row) => row.id);

  const { data: workoutExerciseRows, error: workoutExerciseError } = await client()
    .from(tables.workoutExercises)
    .select("id,workout_id,exercise_id,equipment_id")
    .eq("user_id", userId)
    .in("workout_id", workoutIds)
    .limit(1000);

  if (workoutExerciseError) throw new Error(workoutExerciseError.message);

  const exerciseIds = Array.from(new Set((workoutExerciseRows ?? []).map((row) => row.exercise_id)));
  const equipmentIds = Array.from(
    new Set((workoutExerciseRows ?? []).map((row) => row.equipment_id).filter(Boolean)),
  ) as string[];

  const exerciseResult = exerciseIds.length
    ? await client()
        .from(tables.exercises)
        .select("id,name")
        .eq("user_id", userId)
        .in("id", exerciseIds)
    : { data: [], error: null };

  const equipmentResult = equipmentIds.length
    ? await client()
        .from(tables.equipment)
        .select("id,nickname,equipment_type")
        .eq("user_id", userId)
        .in("id", equipmentIds)
    : { data: [], error: null };

  if (exerciseResult.error) throw new Error(exerciseResult.error.message);
  if (equipmentResult.error) throw new Error(equipmentResult.error.message);

  const exerciseById = new Map((exerciseResult.data ?? []).map((row) => [row.id, row.name]));
  const equipmentById = new Map(
    (equipmentResult.data ?? []).map((row) => [row.id, row.nickname || row.equipment_type]),
  );
  const workoutExerciseById = new Map(
    (workoutExerciseRows ?? []).map((row) => [row.id, row]),
  );
  const workoutExerciseIds = Array.from(workoutExerciseById.keys());

  const { data: setRows, error: setError } = workoutExerciseIds.length
    ? await client()
        .from(tables.sets)
        .select("workout_exercise_id,weight_kg,reps,rir,is_warmup")
        .eq("user_id", userId)
        .in("workout_exercise_id", workoutExerciseIds)
        .limit(2000)
    : { data: [], error: null };

  if (setError) throw new Error(setError.message);

  const setsByWorkout = new Map<string, Array<{
    workout_exercise_id: string;
    weight_kg: number | string;
    reps: number;
    rir: number | null;
    is_warmup: boolean;
  }>>();

  for (const set of setRows ?? []) {
    if (set.is_warmup) continue;
    const workoutExercise = workoutExerciseById.get(set.workout_exercise_id);
    if (!workoutExercise) continue;
    const list = setsByWorkout.get(workoutExercise.workout_id) ?? [];
    list.push(set);
    setsByWorkout.set(workoutExercise.workout_id, list);
  }

  const exerciseCountByWorkout = new Map<string, Set<string>>();
  for (const row of workoutExerciseRows ?? []) {
    const set = exerciseCountByWorkout.get(row.workout_id) ?? new Set<string>();
    set.add(row.exercise_id);
    exerciseCountByWorkout.set(row.workout_id, set);
  }

  return workoutRows.map((workout) => {
    const sets = setsByWorkout.get(workout.id) ?? [];
    let top:
      | { equipmentLabel: string; exerciseName: string; weightKg: number; reps: number; score: number }
      | null = null;

    let volumeKg = 0;

    for (const set of sets) {
      const workoutExercise = workoutExerciseById.get(set.workout_exercise_id);
      if (!workoutExercise) continue;
      const weightKg = Number(set.weight_kg);
      volumeKg += weightKg * set.reps;
      const score = weightKg * (1 + set.reps / 30);

      if (!top || score > top.score) {
        top = {
          equipmentLabel: workoutExercise.equipment_id
            ? equipmentById.get(workoutExercise.equipment_id) ?? "Equipment"
            : "Exercise",
          exerciseName: exerciseById.get(workoutExercise.exercise_id) ?? "Exercise",
          weightKg,
          reps: set.reps,
          score,
        };
      }
    }

    return {
      id: workout.id,
      startedAt: workout.started_at,
      completedAt: workout.completed_at,
      exerciseCount: exerciseCountByWorkout.get(workout.id)?.size ?? 0,
      workingSets: sets.length,
      volumeKg,
      topSet: top
        ? {
            equipmentLabel: top.equipmentLabel,
            exerciseName: top.exerciseName,
            weightKg: top.weightKg,
            reps: top.reps,
          }
        : null,
    };
  });
}

function normaliseProgressionRule(rule: ProgressionRule): ProgressionRule {
  const repLow = Math.max(1, Math.min(50, Math.round(rule.repLow)));
  const repHigh = Math.max(repLow, Math.min(100, Math.round(rule.repHigh)));
  const targetSets = Math.max(1, Math.min(12, Math.round(rule.targetSets)));
  const incrementKg = Math.max(0.25, Math.min(100, Math.round(rule.incrementKg * 4) / 4));

  return { repLow, repHigh, targetSets, incrementKg };
}

function estimated1Rm(set: TrainingSet) {
  return set.weightKg * (1 + set.reps / 30);
}
