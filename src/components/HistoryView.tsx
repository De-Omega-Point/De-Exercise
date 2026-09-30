import type { WorkoutSummary } from "../lib/types";

type HistoryViewProps = {
  workouts: WorkoutSummary[];
  loading: boolean;
};

export function HistoryView({ workouts, loading }: HistoryViewProps) {
  const totalVolume = workouts.reduce((sum, workout) => sum + workout.volumeKg, 0);
  const totalSets = workouts.reduce((sum, workout) => sum + workout.workingSets, 0);

  return (
    <section className="memory-view">
      <div className="memory-header">
        <div>
          <p className="eyebrow">TRAINING HISTORY</p>
          <h2>Recent workouts</h2>
          <p className="subtle">A compact audit trail of the work that feeds your progression engine.</p>
        </div>
        <div className="memory-kpis">
          <Kpi label="Workouts" value={String(workouts.length)} />
          <Kpi label="Working sets" value={String(totalSets)} />
          <Kpi label="Volume" value={totalVolume ? `${Math.round(totalVolume).toLocaleString()} kg` : "—"} />
        </div>
      </div>

      {loading && <div className="empty-state">Loading workout history…</div>}

      {!loading && workouts.length === 0 && (
        <article className="card empty-card">
          <strong>No persisted workouts yet.</strong>
          <p className="subtle">Your first logged working set creates the start of the history trail.</p>
        </article>
      )}

      <div className="history-list">
        {workouts.map((workout) => (
          <article className="card history-card" key={workout.id}>
            <div className="history-date">
              <span>{new Date(workout.startedAt).toLocaleDateString(undefined, { weekday: "short" })}</span>
              <strong>{new Date(workout.startedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</strong>
              <small>{new Date(workout.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small>
            </div>

            <div className="history-metrics">
              <Metric label="Exercises" value={String(workout.exerciseCount)} />
              <Metric label="Working sets" value={String(workout.workingSets)} />
              <Metric label="Volume" value={workout.volumeKg ? `${Math.round(workout.volumeKg).toLocaleString()} kg` : "—"} />
            </div>

            <div className="history-top-set">
              <span className="muted">Top set</span>
              {workout.topSet ? (
                <>
                  <strong>{workout.topSet.weightKg} kg × {workout.topSet.reps}</strong>
                  <small>{workout.topSet.exerciseName} · {workout.topSet.equipmentLabel}</small>
                </>
              ) : (
                <strong>—</strong>
              )}
            </div>

            <span className={workout.completedAt ? "history-status complete" : "history-status"}>
              {workout.completedAt ? "Complete" : "In progress"}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="memory-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
