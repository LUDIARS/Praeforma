import React from 'react';
import type { Contract, Measurement } from '../../../../shared/spec-terms.ts';

/** 入力の文字列から計測 1 件を作る。実測値は値・単位・根拠が揃ったときだけ持ち、欠ければ未計測 (null)。 */
export function measurementFromInput(id: string, input: Record<string, string>): Measurement {
  const value = input.observedValue?.trim() ?? '';
  const observedUnit = input.observedUnit?.trim() || input.unit!.trim();
  const ref = input.observedRef?.trim() ?? '';
  const observed = value !== '' && Number.isFinite(Number(value)) && ref
    ? { value: Number(value), unit: observedUnit, observedAt: input.observedAt?.trim() || null, ref }
    : null;
  return {
    id, subject: input.subject?.trim() ?? '', metric: input.metric!.trim(), unit: input.unit!.trim(),
    method: input.method?.trim() ?? '', period: input.period?.trim() ?? '', target: input.target?.trim() ?? '', observed,
  };
}

/** 入力の文字列から契約 1 件を作る。量が空なら null (0 にしない)。 */
export function contractFromInput(id: string, input: Record<string, string>): Contract {
  const amount = input.amount?.trim() ?? '';
  return {
    id, subject: input.subject?.trim() ?? '', condition: input.condition?.trim() ?? '', judgement: input.judgement?.trim() ?? '',
    reward: {
      content: input.rewardContent?.trim() ?? '',
      amount: amount !== '' && Number.isFinite(Number(amount)) ? Number(amount) : null,
      unit: input.rewardUnit?.trim() || null,
    },
    grantTiming: input.grantTiming?.trim() ?? '', exceptions: input.exceptions?.trim() ?? '',
  };
}

const MEASUREMENT_FIELDS: readonly (readonly [string, string, boolean])[] = [
  ['subject', '対象 (空ならこの仕様)', false], ['metric', '指標', true], ['unit', '単位', true], ['method', '計測方法', false],
  ['period', '期間・集計', false], ['target', '目標・判定条件', false], ['observedValue', '実測値 (未計測なら空)', false],
  ['observedUnit', '実測の単位 (空なら指標の単位)', false], ['observedAt', '観測日時', false], ['observedRef', '観測の根拠 (実測値に必須)', false],
];
const CONTRACT_FIELDS: readonly (readonly [string, string, boolean])[] = [
  ['subject', '対象 (空ならこの仕様)', false], ['condition', '成立条件', false], ['judgement', '判定方法と根拠', false],
  ['rewardContent', '報酬の内容', false], ['amount', '報酬の量 (空なら未定義)', false], ['rewardUnit', '報酬の単位', false],
  ['grantTiming', '付与時点', false], ['exceptions', '例外・取消条件', false],
];

/** 計測・契約の追加フォーム。必須欄以外は空のまま保存でき、未定義として未解決事項に出る。 */
export function SpecTermForm({ kind, disabled, onAdd }: {
  kind: 'measurement' | 'contract';
  disabled: boolean;
  onAdd: (input: Record<string, string>) => void;
}): React.ReactElement {
  const fields = kind === 'measurement' ? MEASUREMENT_FIELDS : CONTRACT_FIELDS;
  const [input, setInput] = React.useState<Record<string, string>>({});
  const ready = fields.every(([key, , required]) => !required || (input[key] ?? '').trim() !== '');
  return <form className="spec-terms-form" onSubmit={(event) => { event.preventDefault(); if (ready) { onAdd(input); setInput({}); } }}>
    <fieldset disabled={disabled}>
      <legend>{kind === 'measurement' ? '計測を追加' : '契約を追加'}</legend>
      {fields.map(([key, label, required]) => <label key={key}>{label}{required ? ' *' : ''}
        <input value={input[key] ?? ''} required={required} onChange={(event) => setInput({ ...input, [key]: event.target.value })} />
      </label>)}
      <button type="submit" disabled={!ready}>追加して保存</button>
    </fieldset>
  </form>;
}
