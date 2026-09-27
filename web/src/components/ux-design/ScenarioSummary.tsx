import React from 'react';
import { ScenarioFields, type ScenarioDraft } from './ScenarioFields.tsx';
import { scenarioCategoryLabels } from '../../../../shared/scenario-experience.ts';
import type { UxScenario } from '../../lib/ux-design-api.ts';

interface Props { scenario: UxScenario; isSaving: boolean; onUpdate: (fields: Partial<UxScenario>) => void; }

function draftFrom(scenario: UxScenario): ScenarioDraft {
  return { name: scenario.name, actor: scenario.actor, context: scenario.context, goal: scenario.goal,
    successOutcome: scenario.successOutcome, sourceProjectKey: scenario.sourceProjectKey ?? '',
    category: scenario.category, experience: scenario.experience, visualDirection: scenario.visualDirection };
}

export function ScenarioSummary({ scenario, isSaving, onUpdate }: Props): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(() => draftFrom(scenario));
  React.useEffect(() => { setDraft(draftFrom(scenario)); setEditing(false); }, [scenario.revision]);
  return <section className="ux-scenario-summary"><div><span className="ux-kicker">{scenarioCategoryLabels[scenario.category]} · r{scenario.revision}</span><h2>{scenario.name}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{scenario.actor} が {scenario.context} に、{scenario.goal}</p><p>ユーザー体験: {scenario.experience || '未記入 — 編集して体験とのつながりを記入してください'}</p>{scenario.category === 'expression' ? <div><h3>シーン全体の表現指示書</h3><p style={{ whiteSpace: 'pre-wrap' }}>{scenario.visualDirection || '未記入'}</p></div> : null}</div><strong>{scenario.successOutcome}</strong><button className="ghost" type="button" onClick={() => setEditing((value) => !value)}>編集</button>
    {editing ? <form className="foundation-form ux-scenario-edit" onSubmit={(event) => { event.preventDefault(); onUpdate({ ...draft, sourceProjectKey: draft.sourceProjectKey || null }); }}>
      <ScenarioFields value={draft} disabled={isSaving} onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} /><button className="primary" type="submit" disabled={isSaving}>UXを保存</button>
    </form> : null}
  </section>;
}
