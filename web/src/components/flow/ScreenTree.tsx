// 左ペイン: 画面 → UI 要素 → 遷移 のツリー。 クリックで会話対象 (Selection) を切り替える。
//
// @spec 5.1 画面構成

import React from 'react';
import type { Transition } from '../../lib/screen-flow-api.ts';
import type { ScreenRow, Selection } from './types.ts';

interface Props {
  projectName: string;
  screens: ScreenRow[];
  transitions: Transition[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  onAddScreen: (name: string) => void;
}

export function ScreenTree({ projectName, screens, transitions, selection, onSelect, onAddScreen }: Props): React.ReactElement {
  const [draft, setDraft] = React.useState('');
  const screenName = new Map(screens.map((s) => [s.id, s.name]));
  const isSel = (kind: Selection['kind'], id: string) => selection.kind === kind && selection.id === id;

  return (
    <div className="flow-tree">
      <button
        type="button"
        className={`flow-tree-item root ${isSel('project', 'project') ? 'selected' : ''}`}
        onClick={() => onSelect({ kind: 'project', id: 'project', name: projectName })}
      >
        {projectName}
      </button>
      {screens.map((s) => (
        <div key={s.id} className="flow-tree-screen">
          <button
            type="button"
            className={`flow-tree-item screen ${isSel('layout', s.id) ? 'selected' : ''}`}
            onClick={() => onSelect({ kind: 'layout', id: s.id, name: s.name })}
          >
            🖥 {s.name}
          </button>
          {s.widgets.map((w) => (
            <button
              key={w.placementId}
              type="button"
              className={`flow-tree-item widget ${isSel('object', w.placementId) ? 'selected' : ''}`}
              onClick={() => onSelect({ kind: 'object', id: w.placementId, name: w.label ?? w.name })}
            >
              ▫ {w.label ?? w.name} <span className="muted">{w.widget ?? ''}</span>
            </button>
          ))}
          {transitions
            .filter((t) => t.fromLayoutId === s.id)
            .map((t) => {
              const origin = s.widgets.find((w) => w.placementId === t.sourceObjectId);
              const name = t.label ?? `[${origin?.label ?? origin?.name ?? '画面'}] ${t.trigger} → ${screenName.get(t.toLayoutId) ?? '?'}`;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`flow-tree-item transition ${isSel('transition', t.id) ? 'selected' : ''}`}
                  onClick={() => onSelect({ kind: 'transition', id: t.id, name })}
                >
                  → {name}
                </button>
              );
            })}
        </div>
      ))}
      <form
        className="flow-tree-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onAddScreen(draft.trim());
          setDraft('');
        }}
      >
        <input className="foundation-form" placeholder="画面を追加" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="ghost">+</button>
      </form>
    </div>
  );
}
