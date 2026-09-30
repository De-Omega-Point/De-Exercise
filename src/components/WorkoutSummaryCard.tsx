import type { WorkoutSummary } from "../lib/types";

type WorkoutSummaryCardProps = {
  workout: WorkoutSummary;
  onDismiss: () => void;
};

export function WorkoutSummaryCard({ workout, onDismiss }: WorkoutSummaryCardProps) {
  const durationMinutes = workout.completedAt
    ? Math.max(
        0,
        Math.round(
          (new Date(workout.completedAt).getTime() - new Date(workout.startedAt).getTime()) / 60_000,
        ),
      )
    : 0;

  return (
    <section className="card workout-summary-card">
      <div>
        <p className="eyebrow">WORKOUT COMPLETE</p>
        <h2>Session banked.</h2>
        <p className="subtle">This workout is closed, preserved in History, and ready to inform your next progression target.</p>
      </div>

      <div className="summary-grid">
        <Metric label="Duration" value={`${durationMinutes} min`} />
        <Metric label="Exercises" value={String(workout.exerciseCount)} />
        <Metric label="Working sets" value={String(workout.workingSets)} />
        <Metric label="Volume" value={`${Math.round(workout.volumeKg).toLocaleString()} kg`} />
      </div>

      {workout.topSet && (
        <div className="summary-top-set">
          <span className="muted">Top set</span>
          <strong>{workout.topSet.weightKg} kg × {workout.topSet.reps}</strong>
          <small>{workout.topSet.exerciseName} · {workout.topSet.equipmentLabel}</small>
        </div>
      )}

      <button type="button" className="secondary-button" onClick={onDismiss}>Close summary</button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
