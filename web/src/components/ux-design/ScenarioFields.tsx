import React from 'react';

export interface ScenarioDraft {
  name: string;
  actor: string;
  context: string;
  goal: string;
  successOutcome: string;
  sourceProjectKey: string;
}

interface Props {
  value: ScenarioDraft;
  onChange: (key: keyof ScenarioDraft, value: string) => void;
  disabled: boolean;
}

/** Creation and editing use the same text fields on both phones and desktops. */
export function ScenarioFields({ value, onChange, disabled }: Props): React.ReactElement {
  return <fieldset className="ux-scenario-fields" disabled={disabled}>
    <label className="simple-field"><span>シナリオ名</span><input required maxLength={200} value={value.name} onChange={(event) => onChange('name', event.target.value)} /></label>
    <label className="simple-field"><span>誰が</span><input required maxLength={500} value={value.actor} onChange={(event) => onChange('actor', event.target.value)} /></label>
    {([['context', 'どんな状況で'], ['goal', '何を達成したいか'], ['successOutcome', 'どうなれば成功か']] as const).map(([key, label]) =>
      <label className="simple-field" key={key}><span>{label}</span><textarea rows={4} maxLength={4000} required={key !== 'context'} value={value[key]} onChange={(event) => onChange(key, event.target.value)} /></label>)}
    <label className="simple-field"><span>題材プロジェクト（任意）</span><input maxLength={100} value={value.sourceProjectKey} onChange={(event) => onChange('sourceProjectKey', event.target.value)} /></label>
  </fieldset>;
}
