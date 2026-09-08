/** Classification and protection declarations for an individual data field. PF-DATA-6. */
import React from 'react';
import type { DataField } from '../../../../shared/data-design.ts';

interface Props { field: DataField; onChange: (patch: Partial<DataField>) => void }

export function DataProtectionEditor({ field, onChange }: Props): React.ReactElement {
  return <details className="data-protection">
    <summary>保護・公開範囲 {field.protection === 'undecided' ? '（未定）' : field.protection === 'required' ? '（保護必須）' : '（保護不要）'}</summary>
    <div className="data-grid">
      <label className="data-check"><input type="checkbox" checked={field.personalData}
        onChange={(event) => onChange({ personalData: event.target.checked,
          ...(event.target.checked ? { protection: 'required' as const } : {}) })} />本人の個人属性</label>
      <label>保護要否
        <select value={field.protection} onChange={(event) => onChange({ protection: event.target.value as DataField['protection'] })}>
          <option value="undecided">未定</option><option value="required">保護必須</option><option value="not_required">保護不要</option>
        </select>
      </label>
    </div>
    {([
      ['protectionNote', '保護方法・判断理由', '例: 本人のみ閲覧可能。転送経路と保管時の保護を記入'],
      ['readAccess', '誰が読めるか', '例: 本人、運用担当者'],
      ['writeAccess', '誰が更新できるか', '例: 本人のみ'],
      ['retention', '保持期間・削除方針', '例: 退会時に削除。利用中は保持'],
    ] as const).map(([key, label, hint]) => <label key={key}>{label}
      <textarea rows={2} maxLength={4000} value={field[key]} placeholder={hint}
        onChange={(event) => onChange({ [key]: event.target.value })} />
    </label>)}
  </details>;
}
