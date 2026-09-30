import { useEffect, useState } from "react";
import type { WorkoutSummary } from "../lib/types";

type WorkoutSessionBarProps = {
  workout: WorkoutSummary | null;
  busy: boolean;
  onStart: () => Promise<void>;
  onFinish: () => Promise<void>;
};

export function WorkoutSessionBar({
  workout,
  busy,
  onStart,
  onFinish,
}: WorkoutSessionBarProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!workout || workout.completedAt) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [workout]);

  if (!workout) {
    return (
      <section className="workout-session-bar idle">
        <div>
          <p className="eyebrow">WORKOUT SESSION</p>
          <strong>Ready when you are.</strong>
          <span>Start a workout before logging working sets.</span>
        </div>
        <button type="button" disabled={busy} onClick={onStart}>
          {busy ? "Starting…" : "Start workout"}
        </button>
      </section>
    );
  }

  const elapsed = Math.max(0, Date.now() - new Date(workout.startedAt).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(minutes / 60);
  const minuteRemainder = minutes % 60;
  const elapsedLabel = hours
    ? `${hours}h ${String(minuteRemainder).padStart(2, "0")}m`
    : `${minutes}m`;

  return (
    <section className="workout-session-bar active">
      <div className="session-live">
        <span className="live-dot" aria-hidden="true" />
        <div>
          <p className="eyebrow">WORKOUT LIVE</p>
          <strong>{elapsedLabel}</strong>
        </div>
      </div>

      <div className="session-metrics">
        <Metric label="Exercises" value={String(workout.exerciseCount)} />
        <Metric label="Working sets" value={String(workout.workingSets)} />
        <Metric label="Volume" value={workout.volumeKg ? `${Math.round(workout.volumeKg).toLocaleString()} kg` : "0 kg"} />
      </div>

      <button type="button" className="finish-button" disabled={busy} onClick={onFinish}>
        {busy ? "Finishing…" : "Finish workout"}
      </button>
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
