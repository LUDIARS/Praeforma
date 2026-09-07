import React from 'react';
import type { UxScenario } from '../../lib/ux-design-api.ts';

interface Props { scenario: UxScenario; isSaving: boolean; onUpdate: (fields: Partial<UxScenario>) => void; }

export function ScenarioSummary({ scenario, isSaving, onUpdate }: Props): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState({ name: scenario.name, actor: scenario.actor, context: scenario.context, goal: scenario.goal, successOutcome: scenario.successOutcome, sourceProjectKey: scenario.sourceProjectKey ?? '' });
  React.useEffect(() => { setDraft({ name: scenario.name, actor: scenario.actor, context: scenario.context, goal: scenario.goal, successOutcome: scenario.successOutcome, sourceProjectKey: scenario.sourceProjectKey ?? '' }); setEditing(false); }, [scenario.revision]);
  return <section className="ux-scenario-summary"><div><span className="ux-kicker">UX scenario · r{scenario.revision}</span><h2>{scenario.name}</h2><p>{scenario.actor} が {scenario.context} に、{scenario.goal}</p></div><strong>{scenario.successOutcome}</strong><button className="ghost" type="button" onClick={() => setEditing((value) => !value)}>編集</button>
    {editing ? <form className="foundation-form ux-scenario-edit" onSubmit={(event) => { event.preventDefault(); onUpdate({ ...draft, sourceProjectKey: draft.sourceProjectKey || null }); }}>
      {([['name', '名前'], ['actor', '誰が'], ['context', '状況'], ['goal', '目的'], ['successOutcome', '成功条件'], ['sourceProjectKey', '題材プロジェクト']] as const).map(([key, label]) => <label key={key} className="simple-field"><span>{label}</span><input value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<button className="primary" type="submit" disabled={isSaving}>更新</button>
    </form> : null}
  </section>;
}
