import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { recogniseEquipment } from "./lib/equipment-recognition";
import {
  ensureExerciseProfile,
  loadRecentSets,
  logTrainingSet,
  saveProgressionRecommendation,
  saveRecognisedEquipment,
} from "./lib/persistence";
import { getProgressionRecommendation } from "./lib/progression";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { EquipmentRecognition, SavedEquipment, TrainingSet } from "./lib/types";

const seedSets: TrainingSet[] = [
  { id: "1", weightKg: 40, reps: 10, rir: 2 },
  { id: "2", weightKg: 40, reps: 10, rir: 2 },
  { id: "3", weightKg: 40, reps: 9, rir: 1 },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [recognition, setRecognition] = useState<EquipmentRecognition | null>(null);
  const [activeEquipment, setActiveEquipment] = useState<SavedEquipment | null>(null);
  const [manualCorrection, setManualCorrection] = useState("");
  const [recognising, setRecognising] = useState(false);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [recognitionError, setRecognitionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [sets, setSets] = useState<TrainingSet[]>(isSupabaseConfigured ? [] : seedSets);
  const [weight, setWeight] = useState(40);
  const [reps, setReps] = useState(10);
  const [rir, setRir] = useState(2);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (!nextSession) {
        setActiveEquipment(null);
        setRecognition(null);
        setSets([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    ensureExerciseProfile(userId).catch((error) => {
      setStatusMessage(error instanceof Error ? error.message : "Could not initialise profile.");
    });
  }, [session?.user.id]);

  const recommendation = useMemo(
    () => getProgressionRecommendation(sets, {
      repLow: 8,
      repHigh: 12,
      targetSets: 3,
      incrementKg: activeEquipment?.loadIncrementKg ?? 2.5,
    }),
    [sets, activeEquipment?.loadIncrementKg],
  );

  if (!authReady) {
    return (
      <main className="shell auth-shell">
        <article className="card auth-card">
          <p className="eyebrow">DE-EXERCISE</p>
          <h1 className="auth-title">Loading your training system…</h1>
        </article>
      </main>
    );
  }

  if (isSupabaseConfigured && !session) {
    return <AuthScreen />;
  }

  const userId = session?.user.id ?? null;
  const isLive = Boolean(userId && supabase);

  async function handleImage(file?: File) {
    if (!file) return;
    setRecognising(true);
    setRecognitionError("");
    setStatusMessage("");
    setManualCorrection("");
    setActiveEquipment(null);
    if (isLive) setSets([]);

    try {
      setRecognition(await recogniseEquipment(file));
    } catch (error) {
      setRecognitionError(error instanceof Error ? error.message : "Recognition failed.");
    } finally {
      setRecognising(false);
    }
  }

  async function confirmEquipment() {
    if (!recognition) return;

    const correction = manualCorrection.trim();
    if (recognition.confidence < 0.75 && !correction) {
      setRecognitionError("Enter a corrected equipment label before saving this low-confidence match.");
      return;
    }

    setSavingEquipment(true);
    setRecognitionError("");
    setStatusMessage("");

    try {
      if (!isLive || !userId) {
        const demoEquipment: SavedEquipment = {
          id: crypto.randomUUID(),
          equipmentType: correction || recognition.equipment_type,
          manufacturer: recognition.manufacturer,
          model: recognition.model,
          exerciseId: "demo-exercise",
          exerciseName: recognition.likely_exercises[0] || correction || recognition.equipment_type,
          loadIncrementKg: 2.5,
        };
        setActiveEquipment(demoEquipment);
        setStatusMessage("Demo machine confirmed locally.");
        return;
      }

      const equipment = await saveRecognisedEquipment(userId, recognition, correction || undefined);
      const recentSets = await loadRecentSets(userId, equipment.id);
      setActiveEquipment(equipment);
      setSets(recentSets);
      if (recentSets.length) {
        setWeight(recentSets[recentSets.length - 1].weightKg);
      }
      setStatusMessage("Machine saved. Exact-machine history is now active.");
    } catch (error) {
      setRecognitionError(error instanceof Error ? error.message : "Could not save equipment.");
    } finally {
      setSavingEquipment(false);
    }
  }

  async function logSet(event: FormEvent) {
    event.preventDefault();

    if (!activeEquipment) {
      setStatusMessage("Scan and confirm a machine before logging working sets.");
      return;
    }

    if (!Number.isFinite(weight) || weight < 0 || reps < 1 || rir < 0 || rir > 10) {
      setStatusMessage("Check weight, reps and RIR before logging.");
      return;
    }

    const values = {
      weightKg: Math.round(weight * 2) / 2,
      reps: Math.round(reps),
      rir: Math.round(rir),
    };

    try {
      if (!isLive || !userId) {
        setSets((current) => [
          ...current,
          { id: crypto.randomUUID(), ...values },
        ]);
        setStatusMessage("Demo set logged locally.");
        return;
      }

      const persisted = await logTrainingSet(userId, activeEquipment, values);
      const nextSets = [...sets, persisted.set];
      setSets(nextSets);

      const nextRecommendation = getProgressionRecommendation(nextSets, {
        repLow: 8,
        repHigh: 12,
        targetSets: 3,
        incrementKg: activeEquipment.loadIncrementKg,
      });

      await saveProgressionRecommendation(
        userId,
        activeEquipment,
        nextRecommendation,
        persisted.workoutId,
      );

      setStatusMessage("Set saved. Next target recalculated and persisted.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not save set.");
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">DE-EXERCISE / PHASE 2</p>
          <h1>Scan the machine. Remember the work. Progress on purpose.</h1>
          <p className="subtle">
            Equipment recognition feeds a deterministic progression engine. The machine, sets and next target now persist to your account.
          </p>
        </div>
        <div className="hero-actions">
          <div className="status-pill">{isLive ? "Live sync" : "Demo mode"} · kg · 8–12</div>
          {isLive && <button type="button" className="secondary-button" onClick={signOut}>Sign out</button>}
        </div>
      </header>

      {statusMessage && <div className="status-banner">{statusMessage}</div>}

      <section className="grid two">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">01 / EQUIPMENT</p>
              <h2>Identify equipment</h2>
            </div>
            <span className="badge">AI assisted</span>
          </div>

          <label className="upload">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(event) => handleImage(event.target.files?.[0])}
            />
            <strong>{recognising ? "Analysing…" : "Take or upload a machine photo"}</strong>
            <span>JPEG, PNG or WebP</span>
          </label>

          {recognitionError && <p className="error">{recognitionError}</p>}

          {recognition && (
            <div className="result">
              <div className="result-top">
                <div>
                  <span className="muted">Likely match</span>
                  <h3>{recognition.equipment_type}</h3>
                </div>
                <strong>{Math.round(recognition.confidence * 100)}%</strong>
              </div>

              <p className="muted">
                {[recognition.manufacturer, recognition.model].filter(Boolean).join(" · ") || "Manufacturer/model not confirmed"}
              </p>

              <div className="chips">
                {recognition.likely_exercises.map((item) => <span key={item}>{item}</span>)}
              </div>

              {recognition.confidence < 0.75 && (
                <div className="correction">
                  <div className="warning">
                    Low-confidence match. Correct the machine label before saving it.
                  </div>
                  <label>
                    <span>Confirmed equipment type</span>
                    <input
                      value={manualCorrection}
                      onChange={(event) => setManualCorrection(event.target.value)}
                      placeholder="e.g. Hammer Strength ISO-Lateral Chest Press"
                    />
                  </label>
                </div>
              )}

              {recognition.candidate_matches.length > 0 && (
                <div className="candidate-list">
                  <span className="muted">Other possibilities</span>
                  <div className="chips">
                    {recognition.candidate_matches.map((candidate) => (
                      <button
                        type="button"
                        className="chip-button"
                        key={candidate.equipment_type + candidate.model}
                        onClick={() => setManualCorrection(candidate.equipment_type)}
                      >
                        {candidate.equipment_type} · {Math.round(candidate.confidence * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p>{recognition.notes}</p>
              <button
                type="button"
                onClick={confirmEquipment}
                disabled={savingEquipment || (recognition.confidence < 0.75 && !manualCorrection.trim())}
              >
                {savingEquipment ? "Saving…" : "Confirm & save equipment"}
              </button>
            </div>
          )}

          {activeEquipment && (
            <div className="active-machine">
              <span className="eyebrow">ACTIVE MACHINE</span>
              <strong>{activeEquipment.equipmentType}</strong>
              <span>{activeEquipment.exerciseName} · {activeEquipment.loadIncrementKg} kg increment</span>
            </div>
          )}
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">02 / WORK SET</p>
              <h2>Log training</h2>
            </div>
            <span className="badge">{activeEquipment ? activeEquipment.exerciseName : "Choose machine"}</span>
          </div>

          <form className="log-form" onSubmit={logSet}>
            <label>
              <span>Weight (kg)</span>
              <input type="number" min="0" step="0.5" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
            </label>
            <label>
              <span>Reps</span>
              <input type="number" min="1" max="100" value={reps} onChange={(e) => setReps(Number(e.target.value))} />
            </label>
            <label>
              <span>RIR</span>
              <input type="number" min="0" max="10" value={rir} onChange={(e) => setRir(Number(e.target.value))} />
            </label>
            <button type="submit" disabled={!activeEquipment}>Log set</button>
          </form>

          <div className="set-list">
            {sets.length === 0 && (
              <div className="empty-state">No working sets saved for this machine yet.</div>
            )}
            {sets.slice(-5).map((set, index) => (
              <div className="set-row" key={set.id}>
                <span>Set {Math.max(1, sets.length - 4 + index)}</span>
                <strong>{set.weightKg} kg × {set.reps}</strong>
                <span>{set.rir} RIR</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card progression">
        <div>
          <p className="eyebrow">03 / PROGRESSION</p>
          <h2>Next target</h2>
          <p className="subtle">{recommendation.explanation}</p>
        </div>
        <div className="target">
          <span>{recommendation.action.replace("_", " ")}</span>
          <strong>{recommendation.targetWeightKg || weight} kg</strong>
          <small>{recommendation.targetRepLow}–{recommendation.targetRepHigh} reps</small>
        </div>
      </section>
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setSubmitting(true);
    setMessage("");

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setMessage("Account created. Check your email to confirm the address, then sign in.");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell auth-shell">
      <article className="card auth-card">
        <p className="eyebrow">DE-EXERCISE</p>
        <h1 className="auth-title">Your machines. Your numbers. Your next move.</h1>
        <p className="subtle">Sign in to sync equipment identity, workout sets and progression history.</p>

        <div className="auth-tabs">
          <button type="button" className={mode === "signin" ? "" : "secondary-button"} onClick={() => setMode("signin")}>Sign in</button>
          <button type="button" className={mode === "signup" ? "" : "secondary-button"} onClick={() => setMode("signup")}>Create account</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Password</span>
            <input type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={submitting}>{submitting ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>

        {message && <div className="status-banner">{message}</div>}
      </article>
    </main>
  );
}
