import { FormEvent, useMemo, useState } from "react";
import { recogniseEquipment } from "./lib/equipment-recognition";
import { getProgressionRecommendation } from "./lib/progression";
import type { EquipmentRecognition, TrainingSet } from "./lib/types";

const seedSets: TrainingSet[] = [
  { id: "1", weightKg: 40, reps: 10, rir: 2 },
  { id: "2", weightKg: 40, reps: 10, rir: 2 },
  { id: "3", weightKg: 40, reps: 9, rir: 1 },
];

export default function App() {
  const [recognition, setRecognition] = useState<EquipmentRecognition | null>(null);
  const [recognising, setRecognising] = useState(false);
  const [recognitionError, setRecognitionError] = useState("");
  const [sets, setSets] = useState<TrainingSet[]>(seedSets);
  const [weight, setWeight] = useState(40);
  const [reps, setReps] = useState(10);
  const [rir, setRir] = useState(2);

  const recommendation = useMemo(
    () => getProgressionRecommendation(sets, { repLow: 8, repHigh: 12, targetSets: 3, incrementKg: 2.5 }),
    [sets],
  );

  async function handleImage(file?: File) {
    if (!file) return;
    setRecognising(true);
    setRecognitionError("");
    try {
      setRecognition(await recogniseEquipment(file));
    } catch (error) {
      setRecognitionError(error instanceof Error ? error.message : "Recognition failed.");
    } finally {
      setRecognising(false);
    }
  }

  function logSet(event: FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(weight) || weight < 0 || reps < 1 || rir < 0) return;
    setSets((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        weightKg: Math.round(weight * 2) / 2,
        reps: Math.round(reps),
        rir: Math.round(rir),
      },
    ]);
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">DE-EXERCISE / MVP</p>
          <h1>Scan the machine. Remember the work. Progress on purpose.</h1>
          <p className="subtle">
            Equipment recognition feeds a deterministic progression engine so your next target is explainable.
          </p>
        </div>
        <div className="status-pill">kg · 8–12 rep range</div>
      </header>

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
                <div className="warning">
                  Low-confidence match. User confirmation is required before this equipment can be saved.
                </div>
              )}
              <p>{recognition.notes}</p>
              <button type="button" disabled={recognition.confidence < 0.75}>
                Confirm equipment
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
            <span className="badge">Thumb-first</span>
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
            <button type="submit">Log set</button>
          </form>

          <div className="set-list">
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
