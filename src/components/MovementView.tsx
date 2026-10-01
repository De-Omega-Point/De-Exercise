import { useMemo, useState } from "react";
import { dailyBaseline, eveningReset, movementWeek, type MovementPrescription } from "../lib/movement-program";

type MovementViewProps = {
  onOpenGym: () => void;
  onOpenRoutines: () => void;
};

type CompletionStore = Record<string, string[]>;

function currentMonday() {
  const now = new Date();
  const jsDay = now.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(now.getDate() + mondayOffset);
  return monday;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function selectedDateKey(index: number) {
  const date = currentMonday();
  date.setDate(date.getDate() + index);
  return localDateKey(date);
}

function todayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function loadCompletions(): CompletionStore {
  try {
    const raw = localStorage.getItem("de-exercise:movement-completions:v1");
    return raw ? JSON.parse(raw) as CompletionStore : {};
  } catch {
    return {};
  }
}

export function MovementView({ onOpenGym, onOpenRoutines }: MovementViewProps) {
  const [selectedIndex, setSelectedIndex] = useState(todayIndex);
  const [completionStore, setCompletionStore] = useState<CompletionStore>(loadCompletions);
  const day = movementWeek[selectedIndex];
  const dateKey = selectedDateKey(selectedIndex);
  const completed = useMemo(() => new Set(completionStore[dateKey] ?? []), [completionStore, dateKey]);

  const taskIds = useMemo(() => [
    ...dailyBaseline.map((_, index) => `baseline-${index}`),
    ...day.gym.map((_, index) => `gym-${index}`),
    ...day.movement.map((_, index) => `movement-${index}`),
    ...eveningReset.map((_, index) => `evening-${index}`),
  ], [day]);

  const completeCount = taskIds.filter((id) => completed.has(id)).length;
  const progress = taskIds.length ? Math.round((completeCount / taskIds.length) * 100) : 0;

  function toggle(id: string) {
    setCompletionStore((current) => {
      const nextForDay = new Set(current[dateKey] ?? []);
      if (nextForDay.has(id)) nextForDay.delete(id);
      else nextForDay.add(id);

      const next = { ...current, [dateKey]: [...nextForDay] };
      localStorage.setItem("de-exercise:movement-completions:v1", JSON.stringify(next));
      return next;
    });
  }

  return (
    <section className="movement-view">
      <div className="movement-hero">
        <div>
          <span className="page-kicker">DE-MOVEMENT · DAILY SYSTEM</span>
          <h1>Strong enough to move freely.</h1>
          <p>Mobility, active flexibility, animal locomotion, soft acrobatics and gym strength in one weekly rhythm.</p>
        </div>
        <div className="movement-progress-orb" aria-label={`${progress}% complete`}>
          <strong>{progress}%</strong>
          <small>today</small>
        </div>
      </div>

      <div className="movement-week-tabs" role="tablist" aria-label="Movement week">
        {movementWeek.map((item, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={selectedIndex === index}
            className={selectedIndex === index ? "active" : ""}
            key={item.id}
            onClick={() => setSelectedIndex(index)}
          >
            <strong>{item.day.slice(0, 3)}</strong>
            <small>{item.theme}</small>
          </button>
        ))}
      </div>

      <article className="movement-day-card">
        <div className="movement-day-heading">
          <div>
            <span className="page-kicker">{day.day.toUpperCase()} · {dateKey}</span>
            <h2>{day.theme}</h2>
            <p><strong>{day.gymFocus}</strong> + {day.movementFocus}</p>
          </div>
          <span className="movement-local-pill">Local-first ✓</span>
        </div>

        <div className="movement-progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        {day.note && <p className="movement-note">{day.note}</p>}
      </article>

      <MovementBlock
        eyebrow="EVERY MORNING · 12–15 MIN"
        title="Daily movement hygiene"
        copy="Prime the joints, open usable range and wake up coordination. This should energise you, not drain you."
        items={dailyBaseline}
        prefix="baseline"
        completed={completed}
        onToggle={toggle}
      />

      <MovementBlock
        eyebrow="GYM / STRENGTH"
        title={day.gymFocus}
        copy={day.gym.length ? "Strength work stays measurable in the De-Exercise workout engine." : "No heavy gym work scheduled. Keep the nervous system fresh."}
        items={day.gym}
        prefix="gym"
        completed={completed}
        onToggle={toggle}
        emptyCopy="Recovery day. No loaded strength block."
        action={day.gym.length ? (
          <button type="button" className="movement-primary-action" onClick={onOpenGym}>Open gym tracker →</button>
        ) : undefined}
      />

      <MovementBlock
        eyebrow="MOVEMENT PRACTICE"
        title={day.movementFocus}
        copy="Control before range. Range before complexity. Complexity before speed."
        items={day.movement}
        prefix="movement"
        completed={completed}
        onToggle={toggle}
      />

      <MovementBlock
        eyebrow="EVERY EVENING · 8–12 MIN"
        title="Reset and restore"
        copy="Downshift, keep range, and leave tomorrow a better body than today inherited."
        items={eveningReset}
        prefix="evening"
        completed={completed}
        onToggle={toggle}
      />

      <article className="movement-flow-card">
        <span className="page-kicker">FLOW VOCABULARY</span>
        <h3>Ape → Cossack → Bear → Kick-through → Crab reach → Shoulder roll → Squat → Cartwheel → Beast → Stand</h3>
        <p>Do not chase speed. Chase clean transitions. When the sequence becomes easy, add range, duration or complexity one variable at a time.</p>
      </article>

      <div className="movement-actions">
        <button type="button" className="soft-button" onClick={onOpenRoutines}>Saved gym routines</button>
        <button type="button" className="movement-primary-action" onClick={onOpenGym}>Train now</button>
      </div>
    </section>
  );
}

type MovementBlockProps = {
  eyebrow: string;
  title: string;
  copy: string;
  items: MovementPrescription[];
  prefix: string;
  completed: Set<string>;
  onToggle: (id: string) => void;
  emptyCopy?: string;
  action?: React.ReactNode;
};

function MovementBlock({
  eyebrow,
  title,
  copy,
  items,
  prefix,
  completed,
  onToggle,
  emptyCopy,
  action,
}: MovementBlockProps) {
  return (
    <article className="movement-block">
      <div className="movement-block-heading">
        <div>
          <span className="page-kicker">{eyebrow}</span>
          <h3>{title}</h3>
          <p>{copy}</p>
        </div>
        {action}
      </div>

      {items.length ? (
        <div className="movement-task-list">
          {items.map((item, index) => {
            const id = `${prefix}-${index}`;
            const done = completed.has(id);
            return (
              <button
                type="button"
                className={`movement-task ${done ? "complete" : ""}`}
                key={id}
                onClick={() => onToggle(id)}
                aria-pressed={done}
              >
                <span className="movement-check">{done ? "✓" : "○"}</span>
                <span>
                  <strong>{item.name}</strong>
                  {item.cue && <small>{item.cue}</small>}
                </span>
                <em>{item.dose}</em>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="movement-empty">{emptyCopy}</div>
      )}
    </article>
  );
}
