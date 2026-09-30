import { FormEvent, useEffect, useState } from "react";
import type { ProgressionRule } from "../lib/types";

type ProgressionRuleEditorProps = {
  rule: ProgressionRule;
  saving: boolean;
  onSave: (rule: ProgressionRule) => Promise<void>;
};

export function ProgressionRuleEditor({
  rule,
  saving,
  onSave,
}: ProgressionRuleEditorProps) {
  const [draft, setDraft] = useState(rule);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDraft(rule);
  }, [rule]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave(draft);
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="rule-summary">
        <div>
          <span className="muted">Progression rule</span>
          <strong>{rule.targetSets} × {rule.repLow}–{rule.repHigh} · +{rule.incrementKg} kg</strong>
        </div>
        <button type="button" className="secondary-button compact-button" onClick={() => setOpen(true)}>
          Edit rule
        </button>
      </div>
    );
  }

  return (
    <form className="rule-editor" onSubmit={submit}>
      <div className="rule-fields">
        <label>
          <span>Min reps</span>
          <input
            type="number"
            min="1"
            max="50"
            value={draft.repLow}
            onChange={(event) => setDraft((current) => ({ ...current, repLow: Number(event.target.value) }))}
          />
        </label>
        <label>
          <span>Max reps</span>
          <input
            type="number"
            min="1"
            max="100"
            value={draft.repHigh}
            onChange={(event) => setDraft((current) => ({ ...current, repHigh: Number(event.target.value) }))}
          />
        </label>
        <label>
          <span>Working sets</span>
          <input
            type="number"
            min="1"
            max="12"
            value={draft.targetSets}
            onChange={(event) => setDraft((current) => ({ ...current, targetSets: Number(event.target.value) }))}
          />
        </label>
        <label>
          <span>Load step (kg)</span>
          <input
            type="number"
            min="0.25"
            max="100"
            step="0.25"
            value={draft.incrementKg}
            onChange={(event) => setDraft((current) => ({ ...current, incrementKg: Number(event.target.value) }))}
          />
        </label>
      </div>

      <div className="rule-actions">
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save rule"}</button>
        <button type="button" className="secondary-button" onClick={() => { setDraft(rule); setOpen(false); }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
