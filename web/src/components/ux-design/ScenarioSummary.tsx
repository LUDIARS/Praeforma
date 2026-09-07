import React from 'react';
import { ScenarioFields } from './ScenarioFields.tsx';
import type { UxScenario } from '../../lib/ux-design-api.ts';

interface Props { scenario: UxScenario; isSaving: boolean; onUpdate: (fields: Partial<UxScenario>) => void; }

export function ScenarioSummary({ scenario, isSaving, onUpdate }: Props): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState({ name: scenario.name, actor: scenario.actor, context: scenario.context, goal: scenario.goal, successOutcome: scenario.successOutcome, sourceProjectKey: scenario.sourceProjectKey ?? '' });
  React.useEffect(() => { setDraft({ name: scenario.name, actor: scenario.actor, context: scenario.context, goal: scenario.goal, successOutcome: scenario.successOutcome, sourceProjectKey: scenario.sourceProjectKey ?? '' }); setEditing(false); }, [scenario.revision]);
  return <section className="ux-scenario-summary"><div><span className="ux-kicker">UX scenario · r{scenario.revision}</span><h2>{scenario.name}</h2><p>{scenario.actor} が {scenario.context} に、{scenario.goal}</p></div><strong>{scenario.successOutcome}</strong><button className="ghost" type="button" onClick={() => setEditing((value) => !value)}>編集</button>
    {editing ? <form className="foundation-form ux-scenario-edit" onSubmit={(event) => { event.preventDefault(); onUpdate({ ...draft, sourceProjectKey: draft.sourceProjectKey || null }); }}>
      <ScenarioFields value={draft} disabled={isSaving} onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} /><button className="primary" type="submit" disabled={isSaving}>UXを保存</button>
    </form> : null}
  </section>;
}
