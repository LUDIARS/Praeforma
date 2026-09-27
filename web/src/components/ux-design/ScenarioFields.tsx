import React from 'react';
import { scenarioCategoryLabels, type ScenarioExperience } from '../../../../shared/scenario-experience.ts';

export interface ScenarioDraft extends ScenarioExperience {
  name: string;
  actor: string;
  context: string;
  goal: string;
  successOutcome: string;
  sourceProjectKey: string;
}

interface Props {
  value: ScenarioDraft;
  onChange: <K extends keyof ScenarioDraft>(key: K, value: ScenarioDraft[K]) => void;
  disabled: boolean;
}

/** Creation and editing use the same text fields on both phones and desktops. */
export function ScenarioFields({ value, onChange, disabled }: Props): React.ReactElement {
  return <fieldset className="ux-scenario-fields" disabled={disabled}>
    <p>やりたいことを流れに沿って書く。操作に限らず、見て感じることもユーザー体験につなげます。</p>
    <label className="simple-field"><span>カテゴリ</span><select value={value.category} onChange={event => onChange('category', event.target.value as ScenarioExperience['category'])}>{Object.entries(scenarioCategoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="simple-field"><span>シナリオ名</span><input required maxLength={200} value={value.name} onChange={(event) => onChange('name', event.target.value)} /></label>
    <label className="simple-field"><span>体験する人</span><input required maxLength={500} value={value.actor} onChange={(event) => onChange('actor', event.target.value)} /></label>
    {([['context', 'どんな状況で'], ['goal', 'やりたいこと（流れに沿って）'], ['experience', 'つながるユーザー体験'], ['successOutcome', 'どうなれば成功か']] as const).map(([key, label]) =>
      <label className="simple-field" key={key}><span>{label}</span><textarea rows={4} maxLength={4000} required={key !== 'context'} value={value[key]} onChange={(event) => onChange(key, event.target.value)} /></label>)}
    <label className="simple-field"><span>題材プロジェクト（任意）</span><input maxLength={100} value={value.sourceProjectKey} onChange={(event) => onChange('sourceProjectKey', event.target.value)} /></label>
    {value.category === 'expression' ? <label className="simple-field"><span>シーン全体の表現指示書</span><textarea required rows={8} maxLength={16000} value={value.visualDirection} placeholder="グラフィックをどう見せたいか。光・色・質感・構図・動きと、それが届ける体験を書きます。" onChange={event => onChange('visualDirection', event.target.value)} /></label> : null}
  </fieldset>;
}
