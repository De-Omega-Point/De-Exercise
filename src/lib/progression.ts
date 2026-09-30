import type { ProgressionRecommendation, TrainingSet } from "./types";

type ProgressionConfig = {
  repLow?: number;
  repHigh?: number;
  targetSets?: number;
  incrementKg?: number;
};

export function getProgressionRecommendation(
  sets: TrainingSet[],
  config: ProgressionConfig = {},
): ProgressionRecommendation {
  const repLow = config.repLow ?? 8;
  const repHigh = config.repHigh ?? 12;
  const targetSets = config.targetSets ?? 3;
  const incrementKg = config.incrementKg ?? 2.5;

  if (sets.length === 0) {
    return {
      action: "hold",
      targetWeightKg: 0,
      targetRepLow: repLow,
      targetRepHigh: repHigh,
      explanation: "Log your first working set to establish a baseline.",
    };
  }

  const recent = sets.slice(-targetSets);
  const last = recent[recent.length - 1];
  const sameLoad = recent.length === targetSets &&
    recent.every((set) => Math.abs(set.weightKg - last.weightKg) < 0.001);

  const readyForLoad = sameLoad &&
    recent.every((set) => set.reps >= repHigh && set.rir >= 1);

  if (readyForLoad) {
    return {
      action: "increase_load",
      targetWeightKg: roundToIncrement(last.weightKg + incrementKg, incrementKg),
      targetRepLow: repLow,
      targetRepHigh: Math.min(repHigh, repLow + 2),
      explanation:
        `All ${targetSets} working sets reached ${repHigh}+ reps with at least 1 RIR. Add ${incrementKg} kg next time and rebuild reps.`,
    };
  }

  const misses = recent.filter((set) => set.reps < repLow).length;
  if (recent.length >= 2 && misses >= 2) {
    const reduction = Math.max(incrementKg, last.weightKg * 0.05);
    return {
      action: "reduce_load",
      targetWeightKg: Math.max(0, roundToIncrement(last.weightKg - reduction, incrementKg)),
      targetRepLow: repLow,
      targetRepHigh: repHigh,
      explanation:
        `Multiple working sets fell below ${repLow} reps. Reduce slightly so quality reps return to the target range.`,
    };
  }

  const hardFailure = recent.some((set) => set.rir === 0 && set.reps < repHigh);
  if (hardFailure) {
    return {
      action: "hold",
      targetWeightKg: last.weightKg,
      targetRepLow: repLow,
      targetRepHigh: repHigh,
      explanation:
        "A recent set reached failure before the top of the range. Hold load and improve reps before adding weight.",
    };
  }

  return {
    action: "increase_reps",
    targetWeightKg: last.weightKg,
    targetRepLow: Math.max(repLow, Math.min(repHigh, last.reps + 1)),
    targetRepHigh: repHigh,
    explanation:
      `Keep ${last.weightKg} kg and add reps until all ${targetSets} working sets reach ${repHigh} reps with at least 1 RIR.`,
  };
}

function roundToIncrement(value: number, increment: number) {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
}
