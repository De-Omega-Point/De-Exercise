import type { EquipmentLibraryItem, WorkoutSummary } from "../lib/types";

type ProgressViewProps = {
  equipment: EquipmentLibraryItem[];
  workouts: WorkoutSummary[];
};

export function ProgressView({ equipment, workouts }: ProgressViewProps) {
  const totalVolume = workouts.reduce((sum, workout) => sum + workout.volumeKg, 0);
  const bestWeight = equipment.reduce((best, item) => {
    if (!best || item.bestWeightKg > best.bestWeightKg) return item;
    return best;
  }, null as EquipmentLibraryItem | null);
  const bestEstimate = equipment.reduce((max, item) => Math.max(max, item.estimated1RmKg), 0);
  const recent = [...workouts].reverse().slice(-8);
  const maxVolume = Math.max(1, ...recent.map((workout) => workout.volumeKg));

  return (
    <section className="progress-view">
      <div className="page-heading happy-heading">
        <div>
          <span className="page-kicker">PROGRESS</span>
          <h2>You’re getting stronger 🎉</h2>
          <p>Small wins, stacked consistently.</p>
        </div>
      </div>

      <div className="progress-hero">
        <span className="progress-hero-icon">↗</span>
        <div>
          <strong>Progressive overload is working.</strong>
          <p>Keep adding reps, load or cleaner execution over time.</p>
        </div>
      </div>

      <div className="progress-stat-grid">
        <Stat label="Total volume" value={totalVolume ? `${Math.round(totalVolume).toLocaleString()} kg` : "—"} tone="blue" />
        <Stat label="Best weight" value={bestWeight ? `${bestWeight.bestWeightKg} kg` : "—"} detail={bestWeight?.nickname || bestWeight?.equipmentType} tone="yellow" />
        <Stat label="Best est. 1RM" value={bestEstimate ? `${bestEstimate.toFixed(1)} kg` : "—"} tone="mint" />
        <Stat label="Workouts logged" value={String(workouts.length)} tone="coral" />
      </div>

      <article className="happy-card volume-card">
        <div className="section-title-row">
          <div>
            <span className="page-kicker">RECENT TREND</span>
            <h3>Workout volume</h3>
          </div>
          <span className="positive-pill">Keep going ↑</span>
        </div>

        {recent.length ? (
          <div className="volume-bars" aria-label="Recent workout volume">
            {recent.map((workout) => (
              <div className="volume-bar-item" key={workout.id}>
                <span style={{ height: `${Math.max(10, (workout.volumeKg / maxVolume) * 100)}%` }} />
                <small>{new Date(workout.startedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">Log a few workouts and your trend will appear here.</div>
        )}
      </article>

      <div className="motivation-card">💪 Stronger than yesterday. That’s the goal.</div>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string | null;
  tone: "blue" | "yellow" | "mint" | "coral";
}) {
  return (
    <article className={`progress-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
