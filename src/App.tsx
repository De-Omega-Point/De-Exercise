import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { EditableSetList } from "./components/EditableSetList";
import { HistoryView } from "./components/HistoryView";
import { LibraryView } from "./components/LibraryView";
import { ProgressionRuleEditor } from "./components/ProgressionRuleEditor";
import { RoutineSessionQueue } from "./components/RoutineSessionQueue";
import { RoutinesView } from "./components/RoutinesView";
import { WorkoutSessionBar } from "./components/WorkoutSessionBar";
import { WorkoutSummaryCard } from "./components/WorkoutSummaryCard";
import { recogniseEquipment } from "./lib/equipment-recognition";
import {
  deleteTrainingSet,
  ensureExerciseProfile,
  finishWorkout,
  getActiveWorkout,
  listEquipmentLibrary,
  listRecentWorkouts,
  loadProgressionRule,
  loadRecentSets,
  logTrainingSet,
  renameEquipment,
  saveProgressionRecommendation,
  saveProgressionRule,
  saveRecognisedEquipment,
  saveWorkoutNotes,
  startWorkout,
  updateTrainingSet,
  uploadEquipmentPhoto,
} from "./lib/persistence";
import { getProgressionRecommendation } from "./lib/progression";
import {
  createRoutine,
  deleteRoutine,
  getActiveRoutineId,
  getRoutineProgress,
  listRoutines,
  startRoutineWorkout,
} from "./lib/routines";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type {
  EquipmentLibraryItem,
  EquipmentRecognition,
  ProgressionRule,
  Routine,
  RoutineProgress,
  SavedEquipment,
  TrainingSet,
  WorkoutSummary,
} from "./lib/types";

const seedSets: TrainingSet[] = [
  { id: "1", weightKg: 40, reps: 10, rir: 2, workoutId: "history-1", setNo: 1 },
  { id: "2", weightKg: 40, reps: 10, rir: 2, workoutId: "history-1", setNo: 2 },
  { id: "3", weightKg: 40, reps: 9, rir: 1, workoutId: "history-1", setNo: 3 },
];

const defaultRule: ProgressionRule = {
  repLow: 8,
  repHigh: 12,
  targetSets: 3,
  incrementKg: 2.5,
};

type AppView = "train" | "library" | "routines" | "history";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [view, setView] = useState<AppView>("train");
  const [recognition, setRecognition] = useState<EquipmentRecognition | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [activeEquipment, setActiveEquipment] = useState<SavedEquipment | null>(null);
  const [activeRule, setActiveRule] = useState<ProgressionRule>(defaultRule);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSummary | null>(null);
  const [completedWorkout, setCompletedWorkout] = useState<WorkoutSummary | null>(null);
  const [manualCorrection, setManualCorrection] = useState("");
  const [recognising, setRecognising] = useState(false);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [setMutating, setSetMutating] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [recognitionError, setRecognitionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [sets, setSets] = useState<TrainingSet[]>(isSupabaseConfigured ? [] : seedSets);
  const [library, setLibrary] = useState<EquipmentLibraryItem[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [routineProgress, setRoutineProgress] = useState<RoutineProgress>({});
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
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
        setActiveWorkout(null);
        setCompletedWorkout(null);
        setRecognition(null);
        setPendingPhoto(null);
        setSets([]);
        setLibrary([]);
        setRoutines([]);
        setActiveRoutine(null);
        setRoutineProgress({});
        setWorkouts([]);
        setView("train");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    setMemoryLoading(true);
    Promise.all([
      ensureExerciseProfile(userId),
      listEquipmentLibrary(userId),
      listRecentWorkouts(userId),
      getActiveWorkout(userId),
      listRoutines(userId),
      getActiveRoutineId(userId),
    ])
      .then(async ([, equipment, recentWorkouts, currentWorkout, savedRoutines, activeRoutineId]) => {
        setLibrary(equipment);
        setWorkouts(recentWorkouts);
        setActiveWorkout(currentWorkout);
        setRoutines(savedRoutines);

        const resumedRoutine = activeRoutineId
          ? savedRoutines.find((routine) => routine.id === activeRoutineId) ?? null
          : null;

        setActiveRoutine(resumedRoutine);

        if (currentWorkout && resumedRoutine) {
          setRoutineProgress(await getRoutineProgress(userId, currentWorkout.id, resumedRoutine));
        } else {
          setRoutineProgress({});
        }
      })
      .catch((error) => {
        setStatusMessage(error instanceof Error ? error.message : "Could not load training memory.");
      })
      .finally(() => setMemoryLoading(false));
  }, [session?.user.id]);

  const recommendation = useMemo(
    () => getProgressionRecommendation(sets, {
      repLow: activeRule.repLow,
      repHigh: activeRule.repHigh,
      targetSets: activeRule.targetSets,
      incrementKg: activeRule.incrementKg,
    }),
    [sets, activeRule],
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

  async function refreshMemory() {
    if (!userId) return;
    setMemoryLoading(true);
    try {
      const [equipment, recentWorkouts, currentWorkout, savedRoutines, activeRoutineId] = await Promise.all([
        listEquipmentLibrary(userId),
        listRecentWorkouts(userId),
        getActiveWorkout(userId),
        listRoutines(userId),
        getActiveRoutineId(userId),
      ]);
      setLibrary(equipment);
      setWorkouts(recentWorkouts);
      setActiveWorkout(currentWorkout);
      setRoutines(savedRoutines);

      const resumedRoutine = activeRoutineId
        ? savedRoutines.find((routine) => routine.id === activeRoutineId) ?? null
        : null;

      setActiveRoutine(resumedRoutine);

      if (currentWorkout && resumedRoutine) {
        setRoutineProgress(await getRoutineProgress(userId, currentWorkout.id, resumedRoutine));
      } else {
        setRoutineProgress({});
      }
    } finally {
      setMemoryLoading(false);
    }
  }

  async function handleImage(file?: File) {
    if (!file) return;
    setRecognising(true);
    setRecognitionError("");
    setStatusMessage("");
    setManualCorrection("");
    setActiveEquipment(null);
    setActiveRule(defaultRule);
    setPendingPhoto(file);
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
        setActiveRule(defaultRule);
        setPendingPhoto(null);
        setStatusMessage("Demo machine confirmed locally.");
        return;
      }

      const equipment = await saveRecognisedEquipment(userId, recognition, correction || undefined);
      let photoMessage = "";

      if (pendingPhoto) {
        try {
          await uploadEquipmentPhoto(userId, equipment.id, pendingPhoto);
        } catch (error) {
          photoMessage = error instanceof Error
            ? ` Machine saved, but the photo could not be stored: ${error.message}`
            : " Machine saved, but the photo could not be stored.";
        }
      }

      const [recentSets, rule] = await Promise.all([
        loadRecentSets(userId, equipment.id),
        loadProgressionRule(userId, equipment),
      ]);

      setActiveEquipment(equipment);
      setActiveRule(rule);
      setSets(recentSets);
      setPendingPhoto(null);

      if (recentSets.length) {
        setWeight(recentSets[recentSets.length - 1].weightKg);
      }

      await refreshMemory();
      setStatusMessage(`Machine saved with persistent memory.${photoMessage}`);
    } catch (error) {
      setRecognitionError(error instanceof Error ? error.message : "Could not save equipment.");
    } finally {
      setSavingEquipment(false);
    }
  }

  async function chooseSavedMachine(item: EquipmentLibraryItem) {
    if (!userId) return;
    setStatusMessage("");

    try {
      const [recentSets, rule] = await Promise.all([
        loadRecentSets(userId, item.id),
        loadProgressionRule(userId, item),
      ]);

      setActiveEquipment(item);
      setActiveRule(rule);
      setSets(recentSets);
      setPendingPhoto(null);

      if (recentSets.length) {
        setWeight(recentSets[recentSets.length - 1].weightKg);
      }

      setRecognition(null);
      setManualCorrection("");
      setView("train");
      setStatusMessage(`${item.nickname || item.equipmentType} loaded with its history and progression rule.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not load machine history.");
    }
  }

  async function handleRename(item: EquipmentLibraryItem, nickname: string) {
    if (!userId) return;

    try {
      await renameEquipment(userId, item.id, nickname);
      await refreshMemory();
      setStatusMessage("Machine nickname updated.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not rename equipment.");
    }
  }

  async function handleStartWorkout() {
    setSessionBusy(true);
    setCompletedWorkout(null);
    setActiveRoutine(null);
    setRoutineProgress({});
    setStatusMessage("");

    try {
      if (!isLive || !userId) {
        setActiveWorkout({
          id: "demo-workout",
          startedAt: new Date().toISOString(),
          completedAt: null,
          notes: null,
          exerciseCount: 0,
          workingSets: 0,
          volumeKg: 0,
          topSet: null,
        });
        setStatusMessage("Demo workout started.");
        return;
      }

      const workout = await startWorkout(userId);
      setActiveWorkout(workout);
      await refreshMemory();
      setStatusMessage("Workout started. Every working set now belongs to this session.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not start workout.");
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleFinishWorkout() {
    if (!activeWorkout) return;

    setSessionBusy(true);
    setStatusMessage("");

    try {
      if (!isLive || !userId) {
        const currentSets = sets.filter((set) => set.workoutId === activeWorkout.id);
        const finished: WorkoutSummary = {
          ...activeWorkout,
          completedAt: new Date().toISOString(),
          exerciseCount: activeEquipment && currentSets.length ? 1 : 0,
          workingSets: currentSets.length,
          volumeKg: currentSets.reduce((sum, set) => sum + set.weightKg * set.reps, 0),
          topSet: activeEquipment && currentSets.length
            ? {
                equipmentLabel: activeEquipment.equipmentType,
                exerciseName: activeEquipment.exerciseName,
                weightKg: Math.max(...currentSets.map((set) => set.weightKg)),
                reps: currentSets.reduce((best, set) => set.weightKg >= best.weightKg ? set : best, currentSets[0]).reps,
              }
            : null,
        };
        setCompletedWorkout(finished);
        setActiveWorkout(null);
        setActiveRoutine(null);
        setRoutineProgress({});
        setStatusMessage("Demo workout finished.");
        return;
      }

      const finished = await finishWorkout(userId, activeWorkout.id);
      setCompletedWorkout(finished);
      setActiveWorkout(null);
      setActiveRoutine(null);
      setRoutineProgress({});
      await refreshMemory();
      setStatusMessage("Workout finished and locked into History.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not finish workout.");
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleSaveNote(note: string) {
    if (!activeWorkout) return;

    setNoteSaving(true);
    setStatusMessage("");

    try {
      if (!isLive || !userId) {
        setActiveWorkout({ ...activeWorkout, notes: note.trim() || null });
        setStatusMessage("Demo workout note saved.");
        return;
      }

      const saved = await saveWorkoutNotes(userId, activeWorkout.id, note);
      setActiveWorkout({ ...activeWorkout, notes: saved });
      setStatusMessage("Workout note saved.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not save workout note.");
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleSaveRule(rule: ProgressionRule) {
    if (!activeEquipment) return;

    setRuleSaving(true);
    setStatusMessage("");

    try {
      if (!isLive || !userId) {
        setActiveRule(rule);
        setActiveEquipment({
          ...activeEquipment,
          loadIncrementKg: rule.incrementKg,
        });
        setStatusMessage("Demo progression rule updated.");
        return;
      }

      const saved = await saveProgressionRule(userId, activeEquipment, rule);
      setActiveRule(saved);
      setActiveEquipment({
        ...activeEquipment,
        loadIncrementKg: saved.incrementKg,
      });
      await refreshMemory();
      setStatusMessage("Progression rule saved for this exact machine.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not save progression rule.");
    } finally {
      setRuleSaving(false);
    }
  }

  async function logSet(event: FormEvent) {
    event.preventDefault();

    if (!activeWorkout) {
      setStatusMessage("Start a workout before logging working sets.");
      return;
    }

    if (!activeEquipment) {
      setStatusMessage("Scan or choose a saved machine before logging working sets.");
      return;
    }

    if (!validSetValues(weight, reps, rir)) {
      setStatusMessage("Check weight, reps and RIR before logging.");
      return;
    }

    const values = cleanSetValues(weight, reps, rir);

    try {
      if (!isLive || !userId) {
        const activeCount = sets.filter((set) => set.workoutId === activeWorkout.id).length;
        const demoSet: TrainingSet = {
          id: crypto.randomUUID(),
          ...values,
          workoutId: activeWorkout.id,
          setNo: activeCount + 1,
        };
        const nextSets = [...sets, demoSet];
        setSets(nextSets);
        setActiveWorkout({
          ...activeWorkout,
          exerciseCount: activeEquipment ? 1 : activeWorkout.exerciseCount,
          workingSets: activeWorkout.workingSets + 1,
          volumeKg: activeWorkout.volumeKg + values.weightKg * values.reps,
        });
        setStatusMessage("Demo set logged locally.");
        return;
      }

      const persisted = await logTrainingSet(userId, activeWorkout.id, activeEquipment, values);
      const nextSets = [...sets, persisted.set];
      setSets(nextSets);

      await persistRecalculatedRecommendation(userId, activeWorkout.id, activeEquipment, nextSets);
      await refreshMemory();
      setStatusMessage("Set saved. Session totals and next target are updated.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not save set.");
    }
  }

  async function handleUpdateSet(
    set: TrainingSet,
    values: { weightKg: number; reps: number; rir: number },
  ) {
    if (!activeWorkout || !activeEquipment) return;

    if (!validSetValues(values.weightKg, values.reps, values.rir)) {
      setStatusMessage("Check the edited weight, reps and RIR.");
      return;
    }

    const clean = cleanSetValues(values.weightKg, values.reps, values.rir);
    setSetMutating(true);
    setStatusMessage("");

    try {
      if (!isLive || !userId) {
        const nextSets = sets.map((item) => item.id === set.id ? { ...item, ...clean } : item);
        setSets(nextSets);
        recalculateDemoWorkout(nextSets);
        setStatusMessage("Demo set corrected.");
        return;
      }

      const updated = await updateTrainingSet(userId, activeWorkout.id, set.id, clean);
      const nextSets = sets.map((item) => item.id === set.id ? updated : item);
      setSets(nextSets);

      await persistRecalculatedRecommendation(userId, activeWorkout.id, activeEquipment, nextSets);
      await refreshMemory();
      setStatusMessage("Set corrected. Session totals and progression target recalculated.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not edit set.");
    } finally {
      setSetMutating(false);
    }
  }

  async function handleUndoSet(set: TrainingSet) {
    if (!activeWorkout || !activeEquipment) return;

    setSetMutating(true);
    setStatusMessage("");

    try {
      if (!isLive || !userId) {
        const nextSets = sets.filter((item) => item.id !== set.id);
        setSets(nextSets);
        recalculateDemoWorkout(nextSets);
        setStatusMessage("Last demo set undone.");
        return;
      }

      await deleteTrainingSet(userId, activeWorkout.id, set.id);
      const nextSets = sets.filter((item) => item.id !== set.id);
      setSets(nextSets);

      await persistRecalculatedRecommendation(userId, activeWorkout.id, activeEquipment, nextSets);
      await refreshMemory();
      setStatusMessage("Last set undone. Session totals and progression target recalculated.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not undo set.");
    } finally {
      setSetMutating(false);
    }
  }

  async function persistRecalculatedRecommendation(
    uid: string,
    workoutId: string,
    equipment: SavedEquipment,
    nextSets: TrainingSet[],
  ) {
    const nextRecommendation = getProgressionRecommendation(nextSets, {
      repLow: activeRule.repLow,
      repHigh: activeRule.repHigh,
      targetSets: activeRule.targetSets,
      incrementKg: activeRule.incrementKg,
    });

    await saveProgressionRecommendation(uid, equipment, nextRecommendation, workoutId);
  }

  function recalculateDemoWorkout(nextSets: TrainingSet[]) {
    if (!activeWorkout) return;
    const current = nextSets.filter((set) => set.workoutId === activeWorkout.id);
    setActiveWorkout({
      ...activeWorkout,
      workingSets: current.length,
      exerciseCount: activeEquipment && current.length ? 1 : 0,
      volumeKg: current.reduce((sum, set) => sum + set.weightKg * set.reps, 0),
    });
  }

  async function handleCreateRoutine(name: string, equipment: EquipmentLibraryItem[]) {
    if (!userId) {
      setStatusMessage("Connect Supabase before saving routines.");
      return;
    }

    setStatusMessage("");

    try {
      await createRoutine(userId, name, equipment);
      await refreshMemory();
      setStatusMessage("Routine saved.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not save routine.");
    }
  }

  async function handleDeleteRoutine(routine: Routine) {
    if (!userId) return;

    setStatusMessage("");

    try {
      await deleteRoutine(userId, routine.id);
      await refreshMemory();
      setStatusMessage(`${routine.name} deleted.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not delete routine.");
    }
  }

  async function handleStartRoutine(routine: Routine) {
    if (!userId) {
      setStatusMessage("Connect Supabase before starting saved routines.");
      return;
    }

    setSessionBusy(true);
    setCompletedWorkout(null);
    setStatusMessage("");

    try {
      const workout = await startRoutineWorkout(userId, routine.id);
      const progress = await getRoutineProgress(userId, workout.id, routine);

      setActiveWorkout(workout);
      setActiveRoutine(routine);
      setRoutineProgress(progress);
      setView("train");

      const firstIncomplete = routine.items.find(
        (item) => (progress[item.equipment.id] ?? 0) < item.targetSets,
      ) ?? routine.items[0];

      if (firstIncomplete) {
        await chooseSavedMachine(firstIncomplete.equipment);
      }

      setStatusMessage(`${routine.name} started. Session queue is live.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not start routine.");
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleRoutineMachineSelect(equipmentId: string) {
    if (!activeRoutine) return;

    const item = activeRoutine.items.find((entry) => entry.equipment.id === equipmentId);
    if (!item) return;

    await chooseSavedMachine(item.equipment);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">DE-EXERCISE / PHASE 6</p>
          <h1>Plan the session. Follow the queue. Progress every machine.</h1>
          <p className="subtle">
            Saved routines turn your machine library into an ordered workout with live exercise completion and one-tap navigation.
          </p>
        </div>
        <div className="hero-actions">
          <div className="status-pill">{isLive ? "Live sync" : "Demo mode"} · kg</div>
          {isLive && <button type="button" className="secondary-button" onClick={signOut}>Sign out</button>}
        </div>
      </header>

      <nav className="app-nav" aria-label="De-Exercise views">
        <button type="button" className={view === "train" ? "active" : ""} onClick={() => setView("train")}>
          Train {activeWorkout && <span>●</span>}
        </button>
        <button type="button" className={view === "library" ? "active" : ""} onClick={() => setView("library")}>
          Library <span>{library.length}</span>
        </button>
        <button type="button" className={view === "routines" ? "active" : ""} onClick={() => setView("routines")}>
          Routines <span>{routines.length}</span>
        </button>
        <button type="button" className={view === "history" ? "active" : ""} onClick={() => setView("history")}>History</button>
      </nav>

      {statusMessage && <div className="status-banner">{statusMessage}</div>}

      {view === "library" && (
        <LibraryView
          items={library}
          loading={memoryLoading}
          onTrain={chooseSavedMachine}
          onRename={handleRename}
        />
      )}

      {view === "routines" && (
        <RoutinesView
          routines={routines}
          equipment={library}
          loading={memoryLoading}
          onCreate={handleCreateRoutine}
          onStart={handleStartRoutine}
          onDelete={handleDeleteRoutine}
        />
      )}

      {view === "history" && (
        <HistoryView workouts={workouts} loading={memoryLoading} />
      )}

      {view === "train" && (
        <>
          <WorkoutSessionBar
            workout={activeWorkout}
            busy={sessionBusy}
            noteSaving={noteSaving}
            onStart={handleStartWorkout}
            onFinish={handleFinishWorkout}
            onSaveNote={handleSaveNote}
          />

          {completedWorkout && (
            <WorkoutSummaryCard
              workout={completedWorkout}
              onDismiss={() => setCompletedWorkout(null)}
            />
          )}

          {activeWorkout && activeRoutine && (
            <RoutineSessionQueue
              routine={activeRoutine}
              progress={routineProgress}
              activeEquipmentId={activeEquipment?.id ?? null}
              onSelect={handleRoutineMachineSelect}
            />
          )}

          <section className="grid two">
            <article className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">01 / EQUIPMENT</p>
                  <h2>{activeEquipment ? "Active machine" : "Identify equipment"}</h2>
                </div>
                <span className="badge">{activeEquipment ? "Memory loaded" : "AI assisted"}</span>
              </div>

              {activeEquipment && (
                <div className="active-machine active-machine-primary">
                  <span className="eyebrow">ACTIVE MACHINE</span>
                  <strong>{activeEquipment.equipmentType}</strong>
                  <span>{activeEquipment.exerciseName} · {activeRule.targetSets} × {activeRule.repLow}–{activeRule.repHigh}</span>
                  <button type="button" className="secondary-button" onClick={() => setView("library")}>
                    Choose another saved machine
                  </button>
                </div>
              )}

              <div className="scan-divider">
                <span>{activeEquipment ? "or scan a new machine" : "scan a new machine"}</span>
              </div>

              <label className="upload">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(event) => handleImage(event.target.files?.[0])}
                />
                <strong>{recognising ? "Analysing…" : "Take or upload a machine photo"}</strong>
                <span>Saved privately after confirmation · max 10 MB</span>
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
                <button type="submit" disabled={!activeEquipment || !activeWorkout}>Log set</button>
              </form>

              {!activeWorkout && (
                <div className="workout-required">Start a workout above to enable set logging.</div>
              )}

              <EditableSetList
                sets={sets}
                activeWorkoutId={activeWorkout?.id ?? null}
                busy={setMutating}
                onUpdate={handleUpdateSet}
                onUndo={handleUndoSet}
              />
            </article>
          </section>

          <section className="card progression progression-phase4">
            <div className="progression-copy">
              <p className="eyebrow">03 / PROGRESSION</p>
              <h2>Next target</h2>
              <p className="subtle">{recommendation.explanation}</p>

              {activeEquipment ? (
                <ProgressionRuleEditor
                  rule={activeRule}
                  saving={ruleSaving}
                  onSave={handleSaveRule}
                />
              ) : (
                <p className="muted">Choose a machine to load its progression rule.</p>
              )}
            </div>

            <div className="target">
              <span>{recommendation.action.replace("_", " ")}</span>
              <strong>{recommendation.targetWeightKg || weight} kg</strong>
              <small>{recommendation.targetRepLow}–{recommendation.targetRepHigh} reps</small>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function validSetValues(weightKg: number, reps: number, rir: number) {
  return Number.isFinite(weightKg)
    && Number.isFinite(reps)
    && Number.isFinite(rir)
    && weightKg >= 0
    && reps >= 1
    && reps <= 100
    && rir >= 0
    && rir <= 10;
}

function cleanSetValues(weightKg: number, reps: number, rir: number) {
  return {
    weightKg: Math.round(weightKg * 2) / 2,
    reps: Math.round(reps),
    rir: Math.round(rir),
  };
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
