import React from 'react';
import type { WebOffset } from '../../../../shared/web-scene-placement.ts';

/** Numeric form of the group-move offset: precise values and a keyboard path for what the drag writes. */
export function WebNodePlacement({ offset, deviceLabel, onChange }: { offset: WebOffset | null; deviceLabel: string; onChange: (offset: WebOffset) => void }): React.ReactElement {
  if (!offset) return <p className="meta">この要素の位置CSS（translate）はpxの値ではないため、ここでは編集できません。CSSクラス定義で確認してください。</p>;
  // Ignore intermediate input such as "-" so typing a negative value is not reset to 0.
  const field = (axis: keyof WebOffset, label: string): React.ReactElement => <label className="simple-field">{label}<input type="number" step={1} value={offset[axis]} onChange={event => {
    const value = event.target.valueAsNumber;
    if (Number.isFinite(value)) onChange({ ...offset, [axis]: value });
  }} /></label>;
  return <fieldset className="web-node-placement"><legend>位置（{deviceLabel}）</legend>
    {field('x', '横 px')}{field('y', '縦 px')}
    <button type="button" disabled={offset.x === 0 && offset.y === 0} onClick={() => onChange({ x: 0, y: 0 })}>位置を戻す</button>
  </fieldset>;
}
