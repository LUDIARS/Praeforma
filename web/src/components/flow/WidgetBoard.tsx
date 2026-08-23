// 中央ペイン上: 画面の UI 要素を仮置き (widget / 表示文言 / action) し、 一覧から選択する。
// 精密な座標配置は既存の配置 editor (/layouts/:lid) に任せ、 ここは「置く・選ぶ」に絞る。
//
// @spec 3.1 UI 要素

import React from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { getToken } from '../../lib/api.ts';
import { errorText } from '../../lib/screen-flow-api.ts';
import type { ScreenRow, Selection } from './types.ts';

interface Props {
  pid: string;
  screen: ScreenRow;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onChanged: () => void;
}

const WIDGETS = ['button', 'label', 'list', 'input', 'image', 'tab', 'modal', 'custom'];
const ACTIONS = ['navigate', 'submit', 'toggle', 'none'];

async function createWidget(pid: string, lid: string, body: { widget: string; label: string; action: string }): Promise<void> {
  const headers = new Headers({ 'content-type': 'application/json' });
  const token = getToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(`/api/projects/${pid}/layouts/${lid}/widgets`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as Error & { body?: unknown };
    err.body = await res.json().catch(() => null);
    throw err;
  }
}

export function WidgetBoard({ pid, screen, selection, onSelect, onChanged }: Props): React.ReactElement {
  const [widget, setWidget] = React.useState('button');
  const [label, setLabel] = React.useState('');
  const [action, setAction] = React.useState('navigate');
  const addM = useMutation({
    mutationFn: () => createWidget(pid, screen.id, { widget, label: label.trim(), action }),
    onSuccess: () => {
      setLabel('');
      onChanged();
    },
  });

  return (
    <div className="widget-board">
      <div className="widget-board-head">
        <button type="button" className={`flow-chip ${selection.kind === 'layout' ? 'selected' : ''}`} onClick={() => onSelect({ kind: 'layout', id: screen.id, name: screen.name })}>
          🖥 {screen.name}
        </button>
        <Link to={`/projects/${pid}/layouts/${screen.id}`} className="muted">
          座標配置 editor →
        </Link>
      </div>
      <div className="widget-grid">
        {screen.widgets.map((w) => (
          <button
            key={w.placementId}
            type="button"
            className={`widget-cell ${w.widget ?? 'custom'} ${selection.kind === 'object' && selection.id === w.placementId ? 'selected' : ''}`}
            onClick={() => onSelect({ kind: 'object', id: w.placementId, name: w.label ?? w.name })}
            title={w.name}
          >
            <span className="widget-kind">{w.widget ?? '?'}</span>
            <span className="widget-label">{w.label ?? w.name}</span>
          </button>
        ))}
        {screen.widgets.length === 0 ? <div className="muted">UI 要素がまだありません</div> : null}
      </div>
      <form
        className="widget-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) return;
          addM.mutate();
        }}
      >
        <select className="foundation-form" value={widget} onChange={(e) => setWidget(e.target.value)}>
          {WIDGETS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <input className="foundation-form" placeholder="表示文言 (例: スタート)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className="foundation-form" value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button type="submit" className="primary" disabled={!label.trim() || addM.isPending}>
          仮置き
        </button>
        {addM.isError ? <span className="error">{errorText(addM.error)}</span> : null}
      </form>
    </div>
  );
}
