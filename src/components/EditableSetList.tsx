import { FormEvent, useMemo, useState } from "react";
import type { TrainingSet } from "../lib/types";

type SetValues = {
  weightKg: number;
  reps: number;
  rir: number;
};

type EditableSetListProps = {
  sets: TrainingSet[];
  activeWorkoutId: string | null;
  busy: boolean;
  onUpdate: (set: TrainingSet, values: SetValues) => Promise<void>;
  onUndo: (set: TrainingSet) => Promise<void>;
};

export function EditableSetList({
  sets,
  activeWorkoutId,
  busy,
  onUpdate,
  onUndo,
}: EditableSetListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SetValues>({ weightKg: 0, reps: 0, rir: 0 });

  const recent = sets.slice(-8);
  const lastActiveId = useMemo(() => {
    if (!activeWorkoutId) return null;
    const activeSets = sets.filter((set) => set.workoutId === activeWorkoutId);
    return activeSets.length ? activeSets[activeSets.length - 1].id : null;
  }, [sets, activeWorkoutId]);

  async function submit(event: FormEvent, set: TrainingSet) {
    event.preventDefault();
    await onUpdate(set, draft);
    setEditingId(null);
  }

  if (!recent.length) {
    return <div className="empty-state">No working sets saved for this machine yet.</div>;
  }

  return (
    <div className="set-list editable-set-list">
      {recent.map((set, index) => {
        const editable = Boolean(activeWorkoutId && set.workoutId === activeWorkoutId);
        const label = set.setNo ? `Set ${set.setNo}` : `Set ${Math.max(1, sets.length - recent.length + index + 1)}`;

        if (editingId === set.id && editable) {
          return (
            <form className="set-edit-row" key={set.id} onSubmit={(event) => submit(event, set)}>
              <label>
                <span>kg</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={draft.weightKg}
                  onChange={(event) => setDraft((current) => ({ ...current, weightKg: Number(event.target.value) }))}
                />
              </label>
              <label>
                <span>Reps</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={draft.reps}
                  onChange={(event) => setDraft((current) => ({ ...current, reps: Number(event.target.value) }))}
                />
              </label>
              <label>
                <span>RIR</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={draft.rir}
                  onChange={(event) => setDraft((current) => ({ ...current, rir: Number(event.target.value) }))}
                />
              </label>
              <button type="submit" disabled={busy}>Save</button>
              <button type="button" className="secondary-button" onClick={() => setEditingId(null)}>Cancel</button>
            </form>
          );
        }

        return (
          <div className="set-row set-row-phase5" key={set.id}>
            <div className="set-identity">
              <span>{label}</span>
              <small>{editable ? "This workout" : "History · locked"}</small>
            </div>
            <strong>{set.weightKg} kg × {set.reps}</strong>
            <span>{set.rir} RIR</span>
            <div className="set-actions">
              {editable && (
                <button
                  type="button"
                  className="secondary-button mini-button"
                  disabled={busy}
                  onClick={() => {
                    setDraft({ weightKg: set.weightKg, reps: set.reps, rir: set.rir });
                    setEditingId(set.id);
                  }}
                >
                  Edit
                </button>
              )}
              {editable && set.id === lastActiveId && (
                <button
                  type="button"
                  className="danger-ghost mini-button"
                  disabled={busy}
                  onClick={() => onUndo(set)}
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
