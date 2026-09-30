export type EquipmentCandidate = {
  equipment_type: string;
  manufacturer: string | null;
  model: string | null;
  confidence: number;
};

export type EquipmentRecognition = {
  equipment_type: string;
  manufacturer: string | null;
  model: string | null;
  likely_exercises: string[];
  primary_muscles: string[];
  confidence: number;
  distinguishing_features: string[];
  notes: string;
  candidate_matches: EquipmentCandidate[];
};

export type SavedEquipment = {
  id: string;
  equipmentType: string;
  manufacturer: string | null;
  model: string | null;
  exerciseId: string;
  exerciseName: string;
  loadIncrementKg: number;
};

export type TrainingSet = {
  id: string;
  weightKg: number;
  reps: number;
  rir: number;
  createdAt?: string;
  workoutId?: string;
  workoutExerciseId?: string;
  setNo?: number;
};

export type EquipmentLibraryItem = SavedEquipment & {
  nickname: string | null;
  lastUsedAt: string | null;
  lastSet: TrainingSet | null;
  bestWeightKg: number;
  estimated1RmKg: number;
  totalWorkingSets: number;
  trend1RmKg: number[];
  photoUrl: string | null;
};

export type WorkoutSummary = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  exerciseCount: number;
  workingSets: number;
  volumeKg: number;
  topSet: {
    equipmentLabel: string;
    exerciseName: string;
    weightKg: number;
    reps: number;
  } | null;
};

export type ProgressionRule = {
  repLow: number;
  repHigh: number;
  targetSets: number;
  incrementKg: number;
};

export type ProgressionRecommendation = {
  action: "increase_reps" | "increase_load" | "hold" | "reduce_load";
  targetWeightKg: number;
  targetRepLow: number;
  targetRepHigh: number;
  explanation: string;
};


export type RoutineItem = {
  id: string;
  sequenceNo: number;
  equipment: EquipmentLibraryItem;
  targetSets: number;
};

export type Routine = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: RoutineItem[];
};

export type RoutineProgress = Record<string, number>;
