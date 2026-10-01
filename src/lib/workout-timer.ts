/** A local, account-scoped timer. Deadlines, not interval ticks, own the clock. */
export type TimerKind = "rest" | "hold";
export type ActiveTimer = {
  id: string;
  kind: TimerKind;
  label: string;
  status: "running" | "paused" | "complete";
  durationMs: number;
  remainingMs: number;
  endsAt: number | null;
  finishedAt: number | null;
  workoutId: string | null;
  setId: string | null;
};
export type TimerPreferences = {
  restSeconds: number;
  exerciseRest: Record<string, number>;
  autoRest: boolean;
  sound: boolean;
  keepAwake: boolean;
};
export type TimerSnapshot = {
  active: ActiveTimer | null;
  preferences: TimerPreferences;
  storageWarning: string;
};
type StoragePort = Pick<Storage, "getItem" | "setItem">;
type TimerOptions = { storage?: StoragePort | null; now?: () => number };
const MAX_SECONDS = 3600;
const freshPreferences = (): TimerPreferences => ({
  restSeconds: 90, exerciseRest: {}, autoRest: true, sound: false, keepAwake: false,
});
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export function secondsWithinRange(value: number, fallback = 90) {
  return finite(value) ? Math.min(MAX_SECONDS, Math.max(0, Math.round(value))) : fallback;
}
export function timerRemaining(timer: ActiveTimer | null, now = Date.now()): number {
  if (!timer || timer.status === "complete") return 0;
  return timer.status === "running" && timer.endsAt !== null
    ? Math.max(0, Math.min(MAX_SECONDS * 1000, timer.endsAt - now))
    : timer.remainingMs;
}
export function timerLabel(milliseconds: number) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function getBrowserStorage(): StoragePort | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
function readActive(value: unknown): ActiveTimer | null {
  if (!record(value) || typeof value.id !== "string" || typeof value.label !== "string"
    || !["rest", "hold"].includes(String(value.kind))
    || !["running", "paused", "complete"].includes(String(value.status))
    || !finite(value.durationMs) || value.durationMs < 1000 || value.durationMs > MAX_SECONDS * 1000
    || !finite(value.remainingMs) || value.remainingMs < 0 || value.remainingMs > MAX_SECONDS * 1000
    || (value.status === "running" && !finite(value.endsAt))) return null;
  return {
    id: value.id.slice(0, 160), kind: value.kind as TimerKind, label: value.label.slice(0, 160),
    status: value.status as ActiveTimer["status"], durationMs: value.durationMs,
    remainingMs: value.remainingMs, endsAt: finite(value.endsAt) ? value.endsAt : null,
    finishedAt: finite(value.finishedAt) ? value.finishedAt : null,
    workoutId: typeof value.workoutId === "string" ? value.workoutId : null,
    setId: typeof value.setId === "string" ? value.setId : null,
  };
}
function readPreferences(value: unknown): TimerPreferences {
  const defaults = freshPreferences();
  if (!record(value)) return defaults;
  const exerciseRest: Record<string, number> = {};
  if (record(value.exerciseRest)) {
    for (const [key, seconds] of Object.entries(value.exerciseRest).slice(0, 1000)) {
      if (key !== "__proto__" && key !== "constructor" && finite(seconds))
        exerciseRest[key] = secondsWithinRange(seconds);
    }
  }
  return {
    restSeconds: finite(value.restSeconds) ? secondsWithinRange(value.restSeconds) : defaults.restSeconds,
    exerciseRest,
    autoRest: typeof value.autoRest === "boolean" ? value.autoRest : defaults.autoRest,
    sound: typeof value.sound === "boolean" ? value.sound : defaults.sound,
    keepAwake: typeof value.keepAwake === "boolean" ? value.keepAwake : defaults.keepAwake,
  };
}
export class WorkoutTimerStore {
  readonly storageKey: string;
  private snapshot: TimerSnapshot;
  private listeners = new Set<() => void>();
  private storage: StoragePort | null;
  private now: () => number;
  constructor(scope: string, options: TimerOptions = {}) {
    this.storageKey = `de-exercise:timer:v1:${encodeURIComponent(scope)}`;
    this.storage = options.storage === undefined ? getBrowserStorage() : options.storage;
    this.now = options.now ?? Date.now;
    this.snapshot = this.load();
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private load(): TimerSnapshot {
    const fallback = { active: null, preferences: freshPreferences(), storageWarning: "" };
    if (!this.storage) return { ...fallback, storageWarning: "Browser storage is unavailable. Timer changes last only in this tab." };
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return fallback;
      const parsed: unknown = JSON.parse(raw);
      if (!record(parsed) || parsed.version !== 1) throw new Error("Invalid timer data");
      let active = readActive(parsed.active);
      if (active?.status === "running" && timerRemaining(active, this.now()) === 0)
        active = { ...active, status: "complete", remainingMs: 0, finishedAt: active.endsAt, endsAt: null };
      return { active, preferences: readPreferences(parsed.preferences), storageWarning: "" };
    } catch {
      return { ...fallback, storageWarning: "Saved timer settings could not be read. Workout history has not been changed." };
    }
  }
  reload = () => { this.snapshot = this.load(); this.listeners.forEach(listener => listener()); };
  private commit(next: TimerSnapshot) {
    let storageWarning = "";
    try {
      if (!this.storage) throw new Error("Unavailable");
      this.storage.setItem(this.storageKey, JSON.stringify({ version: 1, active: next.active, preferences: next.preferences }));
    } catch { storageWarning = "Could not save the timer on this device. It still runs in this tab; a refresh may lose changes."; }
    this.snapshot = { ...next, storageWarning };
    this.listeners.forEach(listener => listener());
  }
  start(seconds: number, label: string, kind: TimerKind = "rest", workoutId: string | null = null, setId: string | null = null) {
    const durationMs = Math.max(1, secondsWithinRange(seconds)) * 1000;
    const now = this.now();
    this.commit({ ...this.snapshot, active: {
      id: `${now}-${Math.random().toString(36).slice(2)}`, kind, label: label.slice(0, 160),
      status: "running", durationMs, remainingMs: durationMs, endsAt: now + durationMs,
      finishedAt: null, workoutId, setId,
    } });
  }
  tick = () => {
    const active = this.snapshot.active;
    if (active?.status === "running" && timerRemaining(active, this.now()) <= 0)
      this.commit({ ...this.snapshot, active: { ...active, status: "complete", remainingMs: 0, finishedAt: active.endsAt, endsAt: null } });
  };
  pause = () => {
    this.tick();
    const active = this.snapshot.active;
    if (active?.status !== "running") return;
    this.commit({ ...this.snapshot, active: { ...active, status: "paused", remainingMs: timerRemaining(active, this.now()), endsAt: null } });
  };
  resume = () => {
    const active = this.snapshot.active;
    if (active?.status !== "paused") return;
    this.commit({ ...this.snapshot, active: { ...active, status: "running", endsAt: this.now() + active.remainingMs } });
  };
  adjust = (seconds: number) => {
    const active = this.snapshot.active;
    if (!active || active.status === "complete" || !finite(seconds)) return;
    const remainingMs = Math.max(0, Math.min(MAX_SECONDS * 1000, timerRemaining(active, this.now()) + seconds * 1000));
    this.commit({ ...this.snapshot, active: {
      ...active, remainingMs, durationMs: Math.max(active.durationMs, remainingMs),
      status: remainingMs === 0 ? "complete" : active.status,
      endsAt: remainingMs && active.status === "running" ? this.now() + remainingMs : null,
      finishedAt: remainingMs === 0 ? this.now() : null,
    } });
  };
  clear = () => { if (this.snapshot.active) this.commit({ ...this.snapshot, active: null }); };
  cancelForSet(setId: string) { if (this.snapshot.active?.setId === setId) this.clear(); }
  cancelForWorkout(workoutId: string) { if (this.snapshot.active?.workoutId === workoutId) this.clear(); }
  setPreference(key: "autoRest" | "sound" | "keepAwake", value: boolean) {
    this.commit({ ...this.snapshot, preferences: { ...this.snapshot.preferences, [key]: value } });
  }
  restFor(exerciseId: string | null) {
    const { preferences } = this.snapshot;
    return exerciseId && Object.hasOwn(preferences.exerciseRest, exerciseId)
      ? preferences.exerciseRest[exerciseId] : preferences.restSeconds;
  }
  setRest(seconds: number, exerciseId: string | null = null) {
    const preferences = this.snapshot.preferences;
    const value = secondsWithinRange(seconds);
    this.commit({ ...this.snapshot, preferences: exerciseId ? {
      ...preferences, exerciseRest: { ...preferences.exerciseRest, [exerciseId]: value },
    } : { ...preferences, restSeconds: value } });
  }
  afterSetSaved(workoutId: string, exerciseId: string, setId: string, label: string) {
    const rest = this.restFor(exerciseId);
    if (this.snapshot.preferences.autoRest && rest > 0) this.start(rest, label, "rest", workoutId, setId);
  }
}
