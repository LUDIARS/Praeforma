import React from 'react';
import type { WebMoveMode } from '../../../../shared/web-scene-move.ts';

export type WebPreviewMode = 'select' | WebMoveMode;

const modes: readonly { value: WebPreviewMode; label: string; hint: string }[] = [
  { value: 'select', label: '選択', hint: 'プレビューの要素をクリックして選択します。プレビューをスクロールできます。' },
  { value: 'group', label: 'グループ移動', hint: '選んだ要素を子孫ごとドラッグで動かします。タブやメニューは親要素を選んでから動かしてください。位置はこの画面の端末のCSSとして保存します。' },
  { value: 'individual', label: '個別移動', hint: '要素を今の親から分離し、ドロップした先の要素へ統合します。緑の枠が移動先、緑の線が並び位置です。' },
];

/** Chooses what a drag on the preview does (PF-WEB-7 / PF-WEB-8). */
export function WebMoveModeControl({ mode, disabled, onChange }: { mode: WebPreviewMode; disabled: boolean; onChange: (mode: WebPreviewMode) => void }): React.ReactElement {
  const name = React.useId();
  return <fieldset className="web-move-mode" disabled={disabled}><legend>プレビューの操作</legend>
    {modes.map(item => <label className="check-row" key={item.value}><input type="radio" name={name} checked={mode === item.value} onChange={() => onChange(item.value)} />{item.label}</label>)}
    <p className="meta">{modes.find(item => item.value === mode)?.hint}</p>
  </fieldset>;
}
