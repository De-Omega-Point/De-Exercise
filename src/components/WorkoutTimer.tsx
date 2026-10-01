import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { timerLabel, timerRemaining, WorkoutTimerStore, type TimerKind } from "../lib/workout-timer";

type Props = {
  store: WorkoutTimerStore;
  openRequest: number;
  exerciseId: string | null;
  exerciseLabel: string;
  workoutId: string | null;
};

/** Keep clock renders inside this component, not the set-entry form. */
export function WorkoutTimer({ store, openRequest, exerciseId, exerciseLabel, workoutId }: Props) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { active, preferences } = snapshot;
  const [, redraw] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<TimerKind>("rest");
  const [seconds, setSeconds] = useState("90");
  const [awake, setAwake] = useState(false);
  const [wakeMessage, setWakeMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const alerted = useRef<string | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const restSeconds = store.restFor(exerciseId);

  useLayoutEffect(() => { if (openRequest > 0) setExpanded(true); }, [openRequest]);
  useEffect(() => { if (kind === "rest") setSeconds(String(restSeconds || 90)); }, [restSeconds, kind]);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (expanded && !element.open) {
      previousFocus.current = document.activeElement as HTMLElement | null;
      element.showModal();
    } else if (!expanded && element.open) element.close();
  }, [expanded]);
  useEffect(() => {
    const tick = () => { store.tick(); redraw(value => value + 1); };
    tick();
    const id = active?.status === "running" ? window.setInterval(tick, 250) : null;
    const sync = (event: StorageEvent) => { if (event.key === store.storageKey) store.reload(); };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      if (id !== null) window.clearInterval(id);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [store, active?.status]);
  useEffect(() => {
    document.documentElement.style.setProperty("--workout-timer-space", active ? "126px" : "0px");
    return () => document.documentElement.style.setProperty("--workout-timer-space", "0px");
  }, [Boolean(active)]);

  // Audio is opt-in and unlocked by a real user gesture before any network await.
  function unlockAudio() {
    if (!preferences.sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => undefined);
    } catch { /* Visual cues remain available when audio is unsupported. */ }
  }
  useEffect(() => {
    document.addEventListener("pointerdown", unlockAudio, true);
    document.addEventListener("keydown", unlockAudio, true);
    return () => {
      document.removeEventListener("pointerdown", unlockAudio, true);
      document.removeEventListener("keydown", unlockAudio, true);
    };
  }, [preferences.sound]);
  useEffect(() => () => { void audio.current?.close().catch(() => undefined); }, []);
  useEffect(() => {
    if (!active || active.status !== "complete" || alerted.current === active.id) return;
    alerted.current = active.id;
    const recent = active.finishedAt !== null && Date.now() - active.finishedAt >= 0 && Date.now() - active.finishedAt < 2500;
    if (!preferences.sound || !recent || document.hidden) return;
    const context = audio.current;
    if (context?.state === "running") {
      try {
        for (const delay of [0, 0.2]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.connect(gain); gain.connect(context.destination);
          oscillator.frequency.value = 660;
          const start = context.currentTime + delay;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
          oscillator.start(start); oscillator.stop(start + 0.17);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        }
      } catch { /* Do not interrupt the session if an audio device disappears. */ }
    }
    try { navigator.vibrate?.([100, 60, 100]); } catch { /* Not supported on every phone. */ }
  }, [active?.id, active?.status, preferences.sound]);

  useEffect(() => {
    let disposed = false;
    let lock: WakeLockSentinel | null = null;
    let requesting = false;
    const eligible = preferences.keepAwake && active?.status === "running";
    async function acquire() {
      if (!eligible || document.hidden || disposed || lock || requesting) return;
      if (!("wakeLock" in navigator)) { setWakeMessage("Screen wake lock is unavailable in this browser."); return; }
      requesting = true;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (disposed) { await next.release(); return; }
        lock = next; setAwake(true); setWakeMessage("");
        next.addEventListener("release", () => { lock = null; if (!disposed) setAwake(false); });
      } catch { if (!disposed) setWakeMessage("The device declined screen wake lock. Check power-saving settings."); }
      finally { requesting = false; }
    }
    setAwake(false);
    if (!eligible) setWakeMessage("");
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => { disposed = true; document.removeEventListener("visibilitychange", acquire); void lock?.release().catch(() => undefined); };
  }, [preferences.keepAwake, active?.status]);

  const remaining = timerRemaining(active);
  const running = active?.status === "running";
  const complete = active?.status === "complete";
  const modeLabel = active?.kind === "hold" ? "Movement" : "Rest";
  const statusLabel = complete ? (active.kind === "rest" ? "Ready for your next set" : "Interval finished")
    : active?.status === "paused" ? "Paused" : `${modeLabel} timer`;
  const duration = Number(seconds);
  const validDuration = Number.isInteger(duration) && duration >= 1 && duration <= 3600;
  function selectDuration(value: number) {
    setSeconds(String(value));
    if (kind === "rest") store.setRest(value, exerciseId);
  }
  function start() {
    if (!validDuration) return;
    if (active && !complete && !window.confirm("Replace the current timer?")) return;
    if (kind === "rest") store.setRest(duration, exerciseId);
    store.start(duration, kind === "rest" ? exerciseLabel : "Movement interval", kind, workoutId);
    setExpanded(false);
  }
  function close() {
    setExpanded(false);
    const element = previousFocus.current;
    if (element?.isConnected) element.focus();
  }
  return <>
    {active && <aside className={`workout-timer-dock ${complete ? "is-complete" : ""}`} aria-label="Workout timer">
      <div className="timer-dock-controls">
        <button className="timer-expand" type="button" onClick={() => setExpanded(true)} aria-label={`Expand ${modeLabel.toLowerCase()} timer`}>
          <small>{complete ? "Ready" : statusLabel}</small><strong aria-hidden="true">{timerLabel(remaining)}</strong>
        </button>
        {!complete && <>
          <button type="button" onClick={running ? store.pause : store.resume}>{running ? "Pause" : "Resume"}</button>
          <button type="button" onClick={() => store.adjust(15)} aria-label="Add 15 seconds">+15s</button>
        </>}
        <button type="button" onClick={store.clear}>{complete ? "Done" : "Skip"}</button>
      </div>
      <div className="timer-dock-context"><span>{active.label}</span>{awake && <small>Screen on</small>}</div>
      <div className="timer-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, 100 * remaining / active.durationMs)}%` }} /></div>
      <span className="timer-sr-only" role="status">{statusLabel}</span>
    </aside>}
    <dialog className="workout-timer-dialog" ref={dialog} aria-labelledby="timer-title" onClose={close} onCancel={event => { event.preventDefault(); setExpanded(false); }}>
      <header className="timer-dialog-heading"><div><span className="page-kicker">DE-EXERCISE</span><h2 id="timer-title">Your training timer</h2></div>
        <button type="button" onClick={() => setExpanded(false)} aria-label="Close timer settings">✕</button>
      </header>
      {active && <section className="timer-active-panel" aria-label="Active timer">
        <span>{statusLabel}</span><strong role="timer" aria-live="off" aria-label={`${modeLabel} remaining`}>{timerLabel(remaining)}</strong><p>{active.label}</p>
        <div className="timer-active-controls">
          {!complete && <>
            <button type="button" onClick={() => store.adjust(-15)} aria-label="Subtract 15 seconds">−15s</button>
            <button type="button" onClick={running ? store.pause : store.resume}>{running ? "Pause" : "Resume"}</button>
            <button type="button" onClick={() => store.adjust(15)} aria-label="Add 15 seconds">+15s</button>
          </>}
          <button type="button" onClick={store.clear}>{complete ? "Done" : "Skip timer"}</button>
        </div>
        {active.kind === "hold" && <small>Finishing a timer does not automatically mark the exercise complete.</small>}
      </section>}
      <div className="timer-kind" role="group" aria-label="Timer mode">
        <button type="button" aria-pressed={kind === "rest"} onClick={() => setKind("rest")}>Rest between sets</button>
        <button type="button" aria-pressed={kind === "hold"} onClick={() => { setKind("hold"); setSeconds("30"); }}>Hold / mobility</button>
      </div>
      <p className="timer-setting-description">{kind === "rest" ? `Next rest for ${exerciseId ? exerciseLabel : "all exercises without a custom rest"}. Adjust a running timer with ±15s above.` : "Choose a hold or mobility interval. Confirm completed exercises yourself."}</p>
      <div className="timer-presets" role="group" aria-label="Duration presets">
        {(kind === "rest" ? [60, 90, 120, 180] : [20, 30, 45, 60]).map(value =>
          <button key={value} type="button" aria-pressed={duration === value} onClick={() => selectDuration(value)}>{timerLabel(value * 1000)}</button>)}
      </div>
      <label className="timer-custom">Custom duration (seconds)<input type="number" inputMode="numeric" min="1" max="3600" step="1" value={seconds} onChange={event => setSeconds(event.target.value)} /></label>
      <div className="timer-start-actions">
        {kind === "rest" && <button type="button" disabled={!validDuration} onClick={() => { store.setRest(duration, exerciseId); setExpanded(false); }}>Save rest setting</button>}
        <button type="button" className="timer-primary" disabled={!validDuration} onClick={start}>{active && !complete ? "Replace timer" : `Start ${kind === "rest" ? "rest" : "interval"}`}</button>
      </div>
      <fieldset className="timer-preferences"><legend>Keep it simple</legend>
        <label><input type="checkbox" checked={preferences.autoRest} onChange={event => store.setPreference("autoRest", event.target.checked)} /> Start rest after a successfully saved set</label>
        <label><input type="checkbox" checked={preferences.sound} onChange={event => store.setPreference("sound", event.target.checked)} /> Sound + vibration where supported</label>
        <label><input type="checkbox" checked={preferences.keepAwake} onChange={event => store.setPreference("keepAwake", event.target.checked)} /> Keep screen awake while timing</label>
      </fieldset>
      {wakeMessage && <p className="timer-warning" role="status">{wakeMessage}</p>}
      {snapshot.storageWarning && <p className="timer-warning" role="status">{snapshot.storageWarning}</p>}
      <p className="timer-browser-note">The timer catches up when you return. Sound is not guaranteed with the phone locked or the browser suspended. Screen-on mode uses more battery.</p>
    </dialog>
  </>;
}

export function RestTimerButton({ store, exerciseId, onOpen }: { store: WorkoutTimerStore; exerciseId: string | null; onOpen: () => void }) {
  const { preferences, storageWarning } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const seconds = store.restFor(exerciseId);
  return <div className="rest-setting-row">
    <button type="button" className="rest-setting-button" onClick={onOpen}>⏱ Rest {timerLabel(seconds * 1000)} · {preferences.autoRest && seconds > 0 ? "Auto on" : "Manual"}</button>
    {storageWarning && <small role="status">Timer storage unavailable; this tab only.</small>}
  </div>;
}
