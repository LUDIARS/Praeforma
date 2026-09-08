/** Dataset metadata and its ordered fields. The page owns persistence and revisions. PF-DATA-3. */
import React from 'react';
import type { DataDesign, DataSet } from '../../../../shared/data-design.ts';
import { createDataField } from '../../lib/data-design-draft.ts';
import { DataFieldEditor } from './DataFieldEditor.tsx';

interface Props {
  dataset: DataSet; design: DataDesign; disabled: boolean;
  onChange: (dataset: DataSet) => void; onRemove: (fieldId?: string) => void;
}

export function DataSetEditor({ dataset, design, disabled, onChange, onRemove }: Props): React.ReactElement {
  const update = (patch: Partial<DataSet>): void => onChange({ ...dataset, ...patch });
  return <fieldset disabled={disabled} className="data-set">
    <legend>{dataset.label || dataset.name}</legend>
    <div className="data-grid">
      <label>表示名<input maxLength={200} value={dataset.label}
        onChange={(event) => update({ label: event.target.value })} placeholder="例: 通知設定" /></label>
      <label>識別名<input maxLength={63} value={dataset.name}
        onChange={(event) => update({ name: event.target.value })} placeholder="例: notification_preferences" /></label>
    </div>
    <label>目的<textarea rows={2} maxLength={4000} value={dataset.purpose}
      onChange={(event) => update({ purpose: event.target.value })} /></label>
    <div className="data-grid">
      <label>分類<select value={dataset.kind} onChange={(event) => update({ kind: event.target.value as DataSet['kind'] })}>
        <option value="user">ユーザーデータ</option><option value="master">マスタデータ</option>
      </select></label>
      <label>データの件数<select value={dataset.cardinality}
        onChange={(event) => update({ cardinality: event.target.value as DataSet['cardinality'] })}>
        <option value="per_user">1 ユーザー 1 行</option><option value="collection">複数レコード</option>
      </select></label>
    </div>
    <label>権威ソース（誰が正本を管理するか）<input maxLength={500} value={dataset.authority}
      placeholder="例: Cernere / 本人が更新" onChange={(event) => update({ authority: event.target.value })} /></label>
    <div className="data-toolbar">
      <h2>項目 ({dataset.fields.length} / 100)</h2>
      <button type="button" className="ghost" disabled={dataset.fields.length >= 100}
        onClick={() => update({ fields: [...dataset.fields, createDataField(dataset.fields)] })}>項目を追加</button>
    </div>
    {dataset.fields.length === 0 && <p className="data-hint">「項目を追加」から、型と論理保存先を定義してください。</p>}
    {dataset.fields.map((field) => <DataFieldEditor key={field.id} field={field} design={design}
      onChange={(patch) => update({ fields: dataset.fields.map((item) => item.id === field.id ? { ...item, ...patch } : item) })}
      onRemove={() => onRemove(field.id)} />)}
    <button type="button" className="ghost" onClick={() => onRemove()}>このデータセットを削除</button>
  </fieldset>;
}
