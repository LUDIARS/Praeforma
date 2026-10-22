import React from 'react';
import { sceneRoles, type SceneElementRole, type SceneRoleTransition } from '../../../../shared/scene-roles.ts';
import type { UxCanvasDocument } from '../../lib/ux-design-api.ts';
import type { CanvasSelection } from '../ux-design/DesignCanvas.tsx';

interface Props {
  canvas: UxCanvasDocument;
  selection: CanvasSelection | null;
  onSelect: (next: CanvasSelection) => void;
  onChange: (next: UxCanvasDocument) => void;
  disabled: boolean;
}

const kindLabels: Record<SceneElementRole['kind'], string> = { box: '枠', text: 'テキスト', button: 'ボタン', input: '入力', image: '画像', list: 'リスト' };

/** PF-SCENE-9: the role of each drawn object, kept out of the canvas. Selecting a row selects the same object on the canvas. */
export function SceneRolePanel({ canvas, selection, onSelect, onChange, disabled }: Props): React.ReactElement {
  const frames = sceneRoles(canvas);
  const updateTransition = (id: string, patch: { label?: string; trigger?: string }) =>
    onChange({ ...canvas, transitions: canvas.transitions.map(item => item.id === id ? { ...item, ...patch } : item) });
  const removeTransition = (id: string) => onChange({ ...canvas, transitions: canvas.transitions.filter(item => item.id !== id) });
  const transitionList = (transitions: SceneRoleTransition[]) => transitions.length === 0 ? null : <ul className="scene-role-transitions">
    {transitions.map(transition => <li key={transition.id}>
      <span>→ {transition.toFrameName ?? '遷移先なし'}</span>
      <input aria-label="遷移名" value={transition.label} disabled={disabled} onChange={event => updateTransition(transition.id, { label: event.target.value })} />
      <input aria-label="トリガーまたは条件" value={transition.trigger} disabled={disabled} onChange={event => updateTransition(transition.id, { trigger: event.target.value })} />
      <button type="button" className="danger" disabled={disabled} onClick={() => removeTransition(transition.id)}>削除</button>
    </li>)}
  </ul>;
  return <section className="panel scene-role-panel" aria-label="シーンの役割">
    <h3>役割</h3>
    <p className="meta">キャンバスには描画物だけを表示します。各要素が何に対応し、何に応じて変わり、どこへ遷移するかはここで確認します。</p>
    {frames.map(frame => <section key={frame.frameId} className="scene-role-frame">
      <button type="button" className="ghost scene-role-frame-name" aria-pressed={selection?.kind === 'frame' && selection.id === frame.frameId} onClick={() => onSelect({ kind: 'frame', id: frame.frameId })}>{frame.name}</button>
      {frame.description ? <p>{frame.description}</p> : null}
      {frame.stateNames.length > 0 ? <p className="meta">画面内の状態: {frame.stateNames.join(' / ')}</p> : null}
      {transitionList(frame.transitions)}
      {frame.elements.length === 0 ? <p className="meta">この画面に要素はありません。</p> : <ul className="scene-role-elements">
        {frame.elements.map(element => <li key={element.elementId}>
          <button type="button" className="ghost" aria-pressed={selection?.kind === 'element' && selection.id === element.elementId} onClick={() => onSelect({ kind: 'element', id: element.elementId })}>
            <strong>{element.label}</strong> <span className="meta">{kindLabels[element.kind]}</span>
          </button>
          <dl>
            {element.node ? <><dt>対応</dt><dd>{element.node}</dd></> : null}
            {element.dynamic ? <><dt>動的</dt><dd>{element.dynamic.updateCondition ?? '更新条件は未記入'}</dd></> : null}
            {element.follow ? <><dt>追従</dt><dd>{element.follow.targetLabel ?? '対象なし'}{element.follow.condition ? ` — ${element.follow.condition}` : ''}</dd></> : null}
            {element.described ? null : <><dt>役割</dt><dd className="meta">未記入</dd></>}
          </dl>
          {transitionList(element.transitions)}
        </li>)}
      </ul>}
    </section>)}
  </section>;
}
