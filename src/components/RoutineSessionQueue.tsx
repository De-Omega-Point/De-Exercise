import type { Routine, RoutineProgress } from "../lib/types";

type RoutineSessionQueueProps = {
  routine: Routine;
  progress: RoutineProgress;
  activeEquipmentId: string | null;
  onSelect: (equipmentId: string) => Promise<void>;
};

export function RoutineSessionQueue({ routine, progress, activeEquipmentId, onSelect }: RoutineSessionQueueProps) {
  const completed = routine.items.filter((item) => (progress[item.equipment.id] ?? 0) >= item.targetSets).length;
  const currentIndex = routine.items.findIndex((item) => item.equipment.id === activeEquipmentId);
  const next = routine.items.find((item, index) => {
    const done = (progress[item.equipment.id] ?? 0) >= item.targetSets;
    return !done && index > currentIndex;
  }) ?? routine.items.find((item) => (progress[item.equipment.id] ?? 0) < item.targetSets && item.equipment.id !== activeEquipmentId);

  const percent = routine.items.length ? (completed / routine.items.length) * 100 : 0;

  return (
    <section className="card routine-queue">
      <div className="routine-queue-header">
        <div>
          <p className="eyebrow">ACTIVE ROUTINE</p>
          <h2>{routine.name}</h2>
        </div>
        <strong>{completed}/{routine.items.length} complete</strong>
      </div>

      <div className="routine-progress-track" aria-label={`${completed} of ${routine.items.length} routine items complete`}>
        <span style={{ width: `${percent}%` }} />
      </div>

      <div className="routine-queue-list">
        {routine.items.map((item) => {
          const count = progress[item.equipment.id] ?? 0;
          const done = count >= item.targetSets;
          const active = item.equipment.id === activeEquipmentId;
          return (
            <button type="button" className={`routine-queue-item${active ? " active" : ""}${done ? " complete" : ""}`} key={item.id} onClick={() => onSelect(item.equipment.id)}>
              <span>{item.sequenceNo}</span>
              <div>
                <strong>{item.equipment.nickname || item.equipment.equipmentType}</strong>
                <small>{item.equipment.exerciseName}</small>
              </div>
              <em>{count}/{item.targetSets} sets</em>
            </button>
          );
        })}
      </div>

      {next && (
        <button type="button" className="routine-next-button" onClick={() => onSelect(next.equipment.id)}>
          Next machine · {next.equipment.nickname || next.equipment.equipmentType}
        </button>
      )}
    </section>
  );
}