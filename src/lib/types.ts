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
};

export type EquipmentLibraryItem = SavedEquipment & {
  nickname: string | null;
  lastUsedAt: string | null;
  lastSet: TrainingSet | null;
  bestWeightKg: number;
  estimated1RmKg: number;
  totalWorkingSets: number;
  trend1RmKg: number[];
};

export type WorkoutSummary = {
  id: string;
  startedAt: string;
  completedAt: string | null;
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

export type ProgressionRecommendation = {
  action: "increase_reps" | "increase_load" | "hold" | "reduce_load";
  targetWeightKg: number;
  targetRepLow: number;
  targetRepHigh: number;
  explanation: string;
};
