import { useState } from "react";
import type { EquipmentLibraryItem } from "../lib/types";
import { Sparkline } from "./Sparkline";

type LibraryViewProps = {
  items: EquipmentLibraryItem[];
  loading: boolean;
  onTrain: (item: EquipmentLibraryItem) => Promise<void>;
  onRename: (item: EquipmentLibraryItem, nickname: string) => Promise<void>;
};

export function LibraryView({ items, loading, onTrain, onRename }: LibraryViewProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);

  const totalSets = items.reduce((sum, item) => sum + item.totalWorkingSets, 0);
  const bestEstimate = items.reduce((max, item) => Math.max(max, item.estimated1RmKg), 0);

  async function saveRename(item: EquipmentLibraryItem) {
    setSaving(true);
    try {
      await onRename(item, nickname);
      setRenamingId(null);
      setNickname("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="memory-view">
      <div className="memory-header">
        <div>
          <p className="eyebrow">MACHINE MEMORY</p>
          <h2>Your equipment library</h2>
          <p className="subtle">Each saved machine keeps its own photo, training history and progression context.</p>
        </div>
        <div className="memory-kpis">
          <Kpi label="Machines" value={String(items.length)} />
          <Kpi label="Working sets" value={String(totalSets)} />
          <Kpi label="Best est. 1RM" value={bestEstimate ? `${bestEstimate.toFixed(1)} kg` : "—"} />
        </div>
      </div>

      {loading && <div className="empty-state">Loading your equipment memory…</div>}

      {!loading && items.length === 0 && (
        <article className="card empty-card">
          <strong>No saved machines yet.</strong>
          <p className="subtle">Scan and confirm your first piece of equipment, then it will live here with its own photo and numbers.</p>
        </article>
      )}

      <div className="machine-grid">
        {items.map((item) => {
          const label = item.nickname || item.equipmentType;
          return (
            <article className="card machine-card" key={item.id}>
              <div className="machine-photo">
                {item.photoUrl ? (
                  <img src={item.photoUrl} alt={`${label} gym equipment`} />
                ) : (
                  <div className="machine-photo-placeholder" aria-label="No equipment photo saved">
                    <span>PHOTO</span>
                  </div>
                )}
              </div>

              <div className="machine-card-top">
                <div>
                  <p className="eyebrow">{item.exerciseName}</p>
                  <h3>{label}</h3>
                  <p className="muted machine-meta">
                    {[item.manufacturer, item.model].filter(Boolean).join(" · ") || item.equipmentType}
                  </p>
                </div>
                <span className="badge">{item.loadIncrementKg} kg step</span>
              </div>

              <div className="machine-stats">
                <Metric label="Last set" value={item.lastSet ? `${item.lastSet.weightKg} × ${item.lastSet.reps}` : "—"} />
                <Metric label="Best load" value={item.bestWeightKg ? `${item.bestWeightKg} kg` : "—"} />
                <Metric label="Est. 1RM" value={item.estimated1RmKg ? `${item.estimated1RmKg.toFixed(1)} kg` : "—"} />
              </div>

              <div className="trend-row">
                <div>
                  <span className="muted">Recent estimated strength trend</span>
                  <Sparkline
                    values={item.trend1RmKg}
                    label={`Estimated one rep max trend for ${label}`}
                  />
                </div>
                <span className="muted">
                  {item.lastUsedAt ? `Used ${formatRelative(item.lastUsedAt)}` : "Not trained yet"}
                </span>
              </div>

              {renamingId === item.id ? (
                <div className="rename-row">
                  <input
                    autoFocus
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder={item.equipmentType}
                    maxLength={80}
                  />
                  <button type="button" disabled={saving} onClick={() => saveRename(item)}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setRenamingId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="machine-actions">
                  <button type="button" onClick={() => onTrain(item)}>Train on this</button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setRenamingId(item.id);
                      setNickname(item.nickname ?? "");
                    }}
                  >
                    Rename
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="memory-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatRelative(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
