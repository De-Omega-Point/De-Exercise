import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { EditableSetList } from "./components/EditableSetList";
import { HistoryView } from "./components/HistoryView";
import { LibraryView } from "./components/LibraryView";
import { MovementView } from "./components/MovementView";
import { ProgressionRuleEditor } from "./components/ProgressionRuleEditor";
import { OmegaBrandMark } from "./components/OmegaBrandMark";
import { ProgressView } from "./components/ProgressView";
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

type AppView = "train" | "movement" | "progress" | "library" | "routines" | "history";

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
          <OmegaBrandMark />
          <div className="auth-product-lockup">
            <strong><span>De-</span>Exercise</strong>
            <small>A De-Omega-Point product</small>
          </div>
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

  const lastWorkingSet = sets.length ? sets[sets.length - 1] : null;
  const currentWorkoutSets = activeWorkout
    ? sets.filter((set) => set.workoutId === activeWorkout.id)
    : [];
  const currentExerciseSets = currentWorkoutSets.filter(
    (set) => !activeEquipment || set.workoutId === activeWorkout?.id,
  );

  return (
    <main className="app-shell">
      <header className="happy-header">
        <div className="brand-stack">
          <OmegaBrandMark />
          <div className="brand-lockup">
            <strong><span>De-</span>Exercise</strong>
            <small>Progress today. Stronger tomorrow.</small>
          </div>
        </div>
        <div className="header-actions">
          <span className="sync-pill">{isLive ? "● Synced" : "Demo"}</span>
          {isLive && (
            <button type="button" className="icon-button" onClick={signOut} aria-label="Sign out">
              ↗
            </button>
          )}
        </div>
      </header>

      {statusMessage && <div className="happy-status">{statusMessage}</div>}

      {view === "progress" && (
        <ProgressView equipment={library} workouts={workouts} />
      )}

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

      {view === "movement" && (
        <MovementView
          onOpenGym={() => setView("train")}
          onOpenRoutines={() => setView("routines")}
        />
      )}

      {view === "history" && (
        <HistoryView workouts={workouts} loading={memoryLoading} />
      )}

      {view === "train" && (
        <section className="train-page">
          <div className="welcome-row">
            <div>
              <span className="page-kicker">TODAY</span>
              <h1>Let’s get stronger 💪</h1>
              <p>One good set at a time.</p>
            </div>
            <button type="button" className="soft-button" onClick={() => setView("routines")}>
              Routines
            </button>
          </div>

          {!activeWorkout ? (
            <article className="start-workout-card">
              <div>
                <span>Ready?</span>
                <strong>Start today’s workout</strong>
                <small>Your sets, volume and next targets will track automatically.</small>
              </div>
              <button type="button" onClick={handleStartWorkout} disabled={sessionBusy}>
                {sessionBusy ? "Starting…" : "Start workout"}
              </button>
            </article>
          ) : (
            <WorkoutSessionBar
              workout={activeWorkout}
              busy={sessionBusy}
              noteSaving={noteSaving}
              onStart={handleStartWorkout}
              onFinish={handleFinishWorkout}
              onSaveNote={handleSaveNote}
            />
          )}

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

          <article className="progressive-card">
            <div className="progressive-card-top">
              <div>
                <span className="page-kicker">↗ PROGRESSIVE OVERLOAD</span>
                <h2>{activeEquipment ? activeEquipment.exerciseName : "Choose an exercise"}</h2>
                <p>{activeEquipment?.equipmentType || "Load a saved machine or scan a new one."}</p>
              </div>
              <button type="button" className="why-pill" onClick={() => setView("progress")}>
                Progress
              </button>
            </div>

            <div className="target-label">Next target</div>
            <div className="big-target">
              <strong>{recommendation.targetWeightKg || weight} kg</strong>
              <span>·</span>
              <strong>{activeRule.targetSets} × {recommendation.targetRepLow}–{recommendation.targetRepHigh}</strong>
            </div>

            <div className="last-workout-strip">
              <div>
                <span>Last set</span>
                <strong>
                  {lastWorkingSet
                    ? `${lastWorkingSet.weightKg} kg × ${lastWorkingSet.reps}`
                    : "No history yet"}
                </strong>
              </div>
              <div className="positive-copy">
                {recommendation.action === "increase_load"
                  ? `↑ +${activeRule.incrementKg} kg`
                  : recommendation.action === "increase_reps"
                    ? "↑ Add reps"
                    : recommendation.action === "reduce_load"
                      ? "↘ Ease load"
                      : "→ Hold steady"}
              </div>
            </div>

            <p className="target-explanation">{recommendation.explanation}</p>
          </article>

          <article className="happy-card machine-card-simple">
            <div className="section-title-row">
              <div>
                <span className="page-kicker">MACHINE</span>
                <h3>{activeEquipment ? activeEquipment.equipmentType : "Pick your machine"}</h3>
              </div>
              {activeEquipment && <span className="success-pill">✓ Ready</span>}
            </div>

            <div className="machine-shortcuts">
              <button type="button" className="soft-button" onClick={() => setView("library")}>
                {activeEquipment ? "Change machine" : "Saved machines"}
              </button>
              <label className="scan-button">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(event) => handleImage(event.target.files?.[0])}
                />
                {recognising ? "Scanning…" : "📷 Scan new"}
              </label>
            </div>

            {recognitionError && <p className="error">{recognitionError}</p>}

            {recognition && (
              <div className="recognition-simple">
                <div>
                  <span>De-AI match · {Math.round(recognition.confidence * 100)}%</span>
                  <strong>{recognition.equipment_type}</strong>
                  <small>{recognition.likely_exercises[0] || "Exercise equipment"}</small>
                </div>

                {recognition.confidence < 0.75 && (
                  <input
                    value={manualCorrection}
                    onChange={(event) => setManualCorrection(event.target.value)}
                    placeholder="Correct machine name"
                  />
                )}

                <button
                  type="button"
                  onClick={confirmEquipment}
                  disabled={savingEquipment || (recognition.confidence < 0.75 && !manualCorrection.trim())}
                >
                  {savingEquipment ? "Saving…" : "Use this machine"}
                </button>
              </div>
            )}
          </article>

          <article className="happy-card quick-log-card">
            <div className="section-title-row">
              <div>
                <span className="page-kicker">LOG SET</span>
                <h3>Fast numbers. Big progress.</h3>
              </div>
              <span className="set-count-pill">{currentExerciseSets.length} sets today</span>
            </div>

            <form className="quick-log-form" onSubmit={logSet}>
              <div className="number-control blue">
                <span>🏋️ Weight (kg)</span>
                <strong>{weight}</strong>
                <div>
                  <button type="button" onClick={() => setWeight((value) => Math.max(0, Math.round((value - activeRule.incrementKg) * 4) / 4))}>−</button>
                  <button type="button" onClick={() => setWeight((value) => Math.round((value + activeRule.incrementKg) * 4) / 4)}>+</button>
                </div>
                <input
                  aria-label="Weight in kilograms"
                  type="number"
                  min="0"
                  step="0.25"
                  value={weight}
                  onChange={(event) => setWeight(Number(event.target.value))}
                />
              </div>

              <div className="number-control yellow">
                <span>↻ Reps</span>
                <strong>{reps}</strong>
                <div>
                  <button type="button" onClick={() => setReps((value) => Math.max(1, value - 1))}>−</button>
                  <button type="button" onClick={() => setReps((value) => Math.min(100, value + 1))}>+</button>
                </div>
                <input
                  aria-label="Repetitions"
                  type="number"
                  min="1"
                  max="100"
                  value={reps}
                  onChange={(event) => setReps(Number(event.target.value))}
                />
              </div>

              <div className="number-control mint">
                <span>▮▮ RIR</span>
                <strong>{rir}</strong>
                <div>
                  <button type="button" onClick={() => setRir((value) => Math.max(0, value - 1))}>−</button>
                  <button type="button" onClick={() => setRir((value) => Math.min(10, value + 1))}>+</button>
                </div>
                <input
                  aria-label="Reps in reserve"
                  type="number"
                  min="0"
                  max="10"
                  value={rir}
                  onChange={(event) => setRir(Number(event.target.value))}
                />
              </div>

              <button className="save-set-button" type="submit" disabled={!activeEquipment || !activeWorkout}>
                <span>＋</span> Save Set
              </button>
            </form>

            {!activeWorkout && (
              <div className="gentle-warning">Start a workout first, then your sets will track automatically.</div>
            )}

            <div className="target-mini">
              🎯 Target: {recommendation.targetWeightKg || weight} kg · {recommendation.targetRepLow}–{recommendation.targetRepHigh} reps · {activeRule.targetSets} sets
            </div>

            <EditableSetList
              sets={sets}
              activeWorkoutId={activeWorkout?.id ?? null}
              busy={setMutating}
              onUpdate={handleUpdateSet}
              onUndo={handleUndoSet}
            />
          </article>

          <div className="train-actions">
            {activeRoutine && (
              <button
                type="button"
                className="soft-button grow"
                onClick={() => {
                  const next = activeRoutine.items.find(
                    (item) => (routineProgress[item.equipment.id] ?? 0) < item.targetSets
                      && item.equipment.id !== activeEquipment?.id,
                  );
                  if (next) handleRoutineMachineSelect(next.equipment.id);
                }}
              >
                Next machine →
              </button>
            )}
            {activeWorkout && (
              <button type="button" className="mint-button grow" onClick={handleFinishWorkout}>
                🏁 Finish workout
              </button>
            )}
          </div>

          <details className="advanced-details">
            <summary>Progression settings</summary>
            {activeEquipment ? (
              <ProgressionRuleEditor
                rule={activeRule}
                saving={ruleSaving}
                onSave={handleSaveRule}
              />
            ) : (
              <p>Choose a machine first.</p>
            )}
          </details>
        </section>
      )}

      <nav className="bottom-nav" aria-label="Primary navigation">
        <button type="button" className={view === "train" ? "active" : ""} onClick={() => setView("train")}>
          <span>🏋️</span><small>Train</small>
        </button>
        <button type="button" className={view === "movement" ? "active" : ""} onClick={() => setView("movement")}>
          <span>🤸</span><small>Move</small>
        </button>
        <button type="button" className={view === "progress" ? "active" : ""} onClick={() => setView("progress")}>
          <span>📈</span><small>Progress</small>
        </button>
        <button type="button" className={view === "library" ? "active" : ""} onClick={() => setView("library")}>
          <span>▦</span><small>Library</small>
        </button>
        <button type="button" className={view === "history" ? "active" : ""} onClick={() => setView("history")}>
          <span>◷</span><small>History</small>
        </button>
      </nav>
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
        const emailRedirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo },
        });
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
        <OmegaBrandMark />
        <div className="auth-product-lockup">
          <strong><span>De-</span>Exercise</strong>
          <small>A De-Omega-Point product</small>
        </div>
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
