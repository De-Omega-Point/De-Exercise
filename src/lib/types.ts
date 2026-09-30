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

export type ProgressionRecommendation = {
  action: "increase_reps" | "increase_load" | "hold" | "reduce_load";
  targetWeightKg: number;
  targetRepLow: number;
  targetRepHigh: number;
  explanation: string;
};
