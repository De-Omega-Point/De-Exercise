import { FormEvent, useEffect, useState } from "react";
import type { WorkoutSummary } from "../lib/types";

type WorkoutSessionBarProps = {
  workout: WorkoutSummary | null;
  busy: boolean;
  noteSaving: boolean;
  onStart: () => Promise<void>;
  onFinish: () => Promise<void>;
  onSaveNote: (note: string) => Promise<void>;
};

export function WorkoutSessionBar({
  workout,
  busy,
  noteSaving,
  onStart,
  onFinish,
  onSaveNote,
}: WorkoutSessionBarProps) {
  const [, setTick] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!workout || workout.completedAt) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [workout?.id, workout?.completedAt]);

  useEffect(() => {
    setNote(workout?.notes ?? "");
  }, [workout?.id, workout?.notes]);

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    await onSaveNote(note);
  }

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
  const totalSeconds = Math.floor(elapsed / 1000);
  const elapsedLabel = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;

  return (
    <section className="workout-session-stack">
      <div className="workout-session-bar active">
        <div className="session-live">
          <span className="live-dot" aria-hidden="true" />
          <div>
            <p className="eyebrow">SESSION</p>
            <strong>{elapsedLabel}</strong>
          </div>
        </div>

        <div className="session-metrics">
          <Metric label="Moves" value={String(workout.exerciseCount)} />
          <Metric label="Sets" value={String(workout.workingSets)} />
        </div>

        <button type="button" className="finish-button" aria-label="Finish workout" disabled={busy} onClick={onFinish}>
          {busy ? "Wait…" : "Finish"}
        </button>
      </div>

      <details className="session-note-disclosure"><summary>Workout note (optional)</summary>
      <form className="workout-note" onSubmit={saveNote}>
        <label>
          <span>Workout note</span>
          <textarea
            value={note}
            maxLength={4000}
            placeholder="How did the session feel? Machine setup, cues, anything worth remembering…"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button type="submit" className="secondary-button compact-button" disabled={noteSaving}>
          {noteSaving ? "Saving…" : "Save note"}
        </button>
      </form>
      </details>
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
