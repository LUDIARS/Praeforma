// ビジュアルの種類・名前・メモ・一押しの入力欄 (登録と直しで共通)。PF-VIS-1。
import React from 'react';
import { VISUAL_KINDS, VISUAL_KIND_LABELS, VISUAL_LIMITS as L } from '../../../../shared/project-visual.ts';
import type { VisualFieldsInput } from '../../lib/project-visuals-api.ts';

const KIND_HINTS: Record<VisualFieldsInput['kind'], string> = {
  key_visual: '企画の顔になる 1 枚。企画概要書の候補で最初に選ばれます。',
  concept_art: '世界観や雰囲気を伝える絵。実際の画面ではありません。',
  screenshot: 'ゲームプレイやツールの今の画面。紙面に「現在の画面：名前」として載ります。',
};

export function VisualFields({ value, onChange, disabled }: {
  value: VisualFieldsInput; onChange: (next: VisualFieldsInput) => void; disabled?: boolean;
}): React.ReactElement {
  return <div className="project-visual-fields">
    <label>種類
      <select value={value.kind} disabled={disabled}
        onChange={(e) => onChange({ ...value, kind: e.target.value as VisualFieldsInput['kind'] })}>
        {VISUAL_KINDS.map((k) => <option key={k} value={k}>{VISUAL_KIND_LABELS[k]}</option>)}
      </select>
    </label>
    <span className="project-visual-hint">{KIND_HINTS[value.kind]}</span>
    <label>名前（1 行、{L.label} 字まで）
      <input type="text" value={value.label} maxLength={L.label} disabled={disabled}
        onChange={(e) => onChange({ ...value, label: e.target.value.replace(/\s*\n\s*/g, ' ') })} />
    </label>
    <label>メモ（任意、{L.note} 字まで。何の場面か・見どころなど）
      <textarea rows={2} value={value.note} maxLength={L.note} disabled={disabled}
        onChange={(e) => onChange({ ...value, note: e.target.value })} />
    </label>
    <label className="project-visual-check">
      <input type="checkbox" checked={value.featured} disabled={disabled}
        onChange={(e) => onChange({ ...value, featured: e.target.checked })} />
      一押し（一番面白そうな画面の印。企画概要書の候補で先に選ばれます）
    </label>
  </div>;
}
