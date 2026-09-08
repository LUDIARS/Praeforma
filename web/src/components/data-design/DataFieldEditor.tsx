/** Field structure and reference controls, composing storage and protection editors. PF-DATA-3. */
import React from 'react';
import { DATA_TYPES, type DataDesign, type DataField } from '../../../../shared/data-design.ts';
import { DataStorageEditor } from './DataStorageEditor.tsx';
import { DataProtectionEditor } from './DataProtectionEditor.tsx';

interface Props {
  field: DataField; design: DataDesign;
  onChange: (patch: Partial<DataField>) => void; onRemove: () => void;
}

export function DataFieldEditor({ field, design, onChange, onRemove }: Props): React.ReactElement {
  return <section className="data-field" aria-label={'項目 ' + field.name}>
    <div className="data-toolbar">
      <h3>{field.name || '項目名未記入'}</h3>
      <button type="button" className="ghost" onClick={onRemove}>項目を削除</button>
    </div>
    <div className="data-grid">
      <label>項目名<input value={field.name} maxLength={63}
        onChange={(event) => onChange({ name: event.target.value })} /></label>
      <label>型<select value={field.type} disabled={field.storage.kind === 'cernere_profile'}
        onChange={(event) => onChange({ type: event.target.value as DataField['type'] })}>
        {DATA_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
      </select></label>
    </div>
    <div className="data-flags">
      <label className="data-check"><input type="checkbox" checked={field.required}
        onChange={(event) => onChange({ required: event.target.checked })} />必須</label>
      <label className="data-check"><input type="checkbox" checked={field.primaryKey}
        onChange={(event) => onChange({ primaryKey: event.target.checked,
          ...(event.target.checked ? { required: true } : {}) })} />主キー（設計上の識別項目）</label>
    </div>
    <label>説明<textarea rows={2} maxLength={4000} value={field.description}
      onChange={(event) => onChange({ description: event.target.value })} /></label>
    <label>参照先の項目<select value={field.referenceFieldId ?? ''}
      onChange={(event) => onChange({ referenceFieldId: event.target.value || null })}>
      <option value="">参照なし</option>
      {design.datasets.flatMap((dataset) => dataset.fields.filter((item) => item.id !== field.id)
        .map((item) => <option key={item.id} value={item.id}>{dataset.name}.{item.name} ({item.type})</option>))}
    </select></label>
    <DataStorageEditor field={field} onChange={onChange} />
    <DataProtectionEditor field={field} onChange={onChange} />
  </section>;
}
