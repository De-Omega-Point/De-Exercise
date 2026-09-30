import { useMemo, useState } from "react";
import type { EquipmentLibraryItem, Routine } from "../lib/types";

type RoutinesViewProps = {
  routines: Routine[];
  equipment: EquipmentLibraryItem[];
  loading: boolean;
  onCreate: (name: string, equipment: EquipmentLibraryItem[]) => Promise<void>;
  onStart: (routine: Routine) => Promise<void>;
  onDelete: (routine: Routine) => Promise<void>;
};

export function RoutinesView({ routines, equipment, loading, onCreate, onStart, onDelete }: RoutinesViewProps) {
  const [building, setBuilding] = useState(false);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const equipmentById = useMemo(() => new Map(equipment.map((item) => [item.id, item])), [equipment]);
  const selected = selectedIds.map((id) => equipmentById.get(id)).filter((item): item is EquipmentLibraryItem => Boolean(item));

  async function saveRoutine() {
    setBusy(true);
    try {
      await onCreate(name, selected);
      setName("");
      setSelectedIds([]);
      setBuilding(false);
    } finally {
      setBusy(false);
    }
  }

  function addMachine(id: string) {
    setSelectedIds((current) => current.includes(id) ? current : [...current, id]);
  }

  function removeMachine(id: string) {
    setSelectedIds((current) => current.filter((item) => item !== id));
  }

  function move(index: number, direction: -1 | 1) {
    setSelectedIds((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  return (
    <section className="memory-view">
      <div className="memory-header">
        <div>
          <p className="eyebrow">SESSION PLANNING</p>
          <h2>Routines</h2>
          <p className="subtle">Build an ordered session from machines you already know. Progression rules stay attached to the machine, not duplicated inside the routine.</p>
        </div>
        <button type="button" onClick={() => setBuilding((value) => !value)}>
          {building ? "Close builder" : "New routine"}
        </button>
      </div>

      {building && (
        <article className="card routine-builder">
          <div className="routine-builder-heading">
            <div>
              <p className="eyebrow">ROUTINE BUILDER</p>
              <h3>Choose the order you want to train.</h3>
            </div>
            <span className="badge">{selected.length} machines</span>
          </div>

          <label className="routine-name-field">
            <span>Routine name</span>
            <input value={name} maxLength={100} placeholder="e.g. Upper A" onChange={(event) => setName(event.target.value)} />
          </label>

          <div className="routine-builder-grid">
            <div>
              <span className="builder-label">Available machines</span>
              <div className="routine-machine-pool">
                {equipment.length === 0 && <div className="empty-state">Save equipment in the Library before building a routine.</div>}
                {equipment.map((item) => {
                  const added = selectedIds.includes(item.id);
                  return (
                    <button type="button" className="routine-machine-option" key={item.id} disabled={added} onClick={() => addMachine(item.id)}>
                      <span>{item.nickname || item.equipmentType}</span>
                      <small>{item.exerciseName}</small>
                      <strong>{added ? "Added" : "+"}</strong>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="builder-label">Session order</span>
              <div className="routine-order-list">
                {selected.length === 0 && <div className="empty-state">Add machines from the left to create the session queue.</div>}
                {selected.map((item, index) => (
                  <div className="routine-order-row" key={item.id}>
                    <span className="routine-sequence">{index + 1}</span>
                    <div>
                      <strong>{item.nickname || item.equipmentType}</strong>
                      <small>{item.exerciseName}</small>
                    </div>
                    <div className="routine-order-actions">
                      <button type="button" className="secondary-button mini-button" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                      <button type="button" className="secondary-button mini-button" disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button>
                      <button type="button" className="danger-ghost mini-button" onClick={() => removeMachine(item.id)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button type="button" disabled={busy || !name.trim() || selected.length === 0} onClick={saveRoutine}>
            {busy ? "Saving…" : "Save routine"}
          </button>
        </article>
      )}

      {loading && <div className="empty-state">Loading routines…</div>}
      {!loading && routines.length === 0 && !building && (
        <article className="card empty-card">
          <strong>No routines yet.</strong>
          <p className="subtle">Create one from your saved machines and De-Exercise can guide the entire session in order.</p>
        </article>
      )}

      <div className="routine-grid">
        {routines.map((routine) => (
          <article className="card routine-card" key={routine.id}>
            <div className="routine-card-top">
              <div>
                <p className="eyebrow">SAVED ROUTINE</p>
                <h3>{routine.name}</h3>
              </div>
              <span className="badge">{routine.items.length} exercises</span>
            </div>

            <div className="routine-preview">
              {routine.items.map((item) => (
                <div key={item.id}>
                  <span>{item.sequenceNo}</span>
                  <strong>{item.equipment.nickname || item.equipment.equipmentType}</strong>
                  <small>{item.equipment.exerciseName} · {item.targetSets} working sets</small>
                </div>
              ))}
            </div>

            <div className="routine-card-actions">
              <button type="button" onClick={() => onStart(routine)}>Start routine</button>
              <button type="button" className="danger-ghost" onClick={() => onDelete(routine)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}