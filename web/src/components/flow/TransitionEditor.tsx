// 中央ペイン下: 選択中の UI 要素 (または画面) に「遷移先」を付ける (§3.2、 D1: UI 要素起点)。
//
// @spec 3.2 transitions

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { screenFlowApi, errorText, type Transition } from '../../lib/screen-flow-api.ts';
import type { ScreenRow, Selection } from './types.ts';

interface Props {
  pid: string;
  selection: Selection;
  screens: ScreenRow[];
  transitions: Transition[];
  onChanged: () => void;
}

const TRIGGERS = ['tap', 'submit', 'timeout'];

export function TransitionEditor({ pid, selection, screens, transitions, onChanged }: Props): React.ReactElement | null {
  const qc = useQueryClient();
  const [to, setTo] = React.useState('');
  const [trigger, setTrigger] = React.useState('tap');
  const [eventName, setEventName] = React.useState('');
  const [condition, setCondition] = React.useState('');

  // 起点: object (placement) なら所属画面が from、 layout なら画面起因 (起点なし)
  const originScreen =
    selection.kind === 'object'
      ? screens.find((s) => s.widgets.some((w) => w.placementId === selection.id))
      : selection.kind === 'layout'
        ? screens.find((s) => s.id === selection.id)
        : undefined;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['transitions', pid] });
    onChanged();
  };
  const createM = useMutation({
    mutationFn: () =>
      screenFlowApi.createTransition(pid, {
        from_layout_id: originScreen!.id,
        source_object_id: selection.kind === 'object' ? selection.id : null,
        to_layout_id: to,
        trigger: trigger === 'event' ? `event:${eventName.trim()}` : trigger,
        condition: condition.trim(),
      }),
    onSuccess: () => {
      setTo('');
      setCondition('');
      invalidate();
    },
  });
  const deleteM = useMutation({ mutationFn: (tid: string) => screenFlowApi.deleteTransition(pid, tid), onSuccess: invalidate });

  if (!originScreen) return null;
  const mine = transitions.filter((t) =>
    selection.kind === 'object' ? t.sourceObjectId === selection.id : t.fromLayoutId === originScreen.id && t.sourceObjectId === null,
  );
  const screenName = (id: string) => screens.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="transition-editor">
      <div className="transition-head">
        <strong>遷移先</strong>{' '}
        <span className="muted">
          {selection.kind === 'object' ? `起点: ${selection.name} (${originScreen.name})` : `画面起因 (${originScreen.name})`}
        </span>
      </div>
      <ul className="transition-list">
        {mine.map((t) => (
          <li key={t.id}>
            → {screenName(t.toLayoutId)} <span className="muted">{t.trigger}{t.condition ? ` / ${t.condition}` : ''}</span>
            <button type="button" className="ghost" onClick={() => deleteM.mutate(t.id)}>
              ×
            </button>
          </li>
        ))}
        {mine.length === 0 ? <li className="muted">まだ遷移がありません</li> : null}
      </ul>
      <form
        className="transition-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!to) return;
          createM.mutate();
        }}
      >
        <select className="foundation-form" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">遷移先の画面…</option>
          {screens.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="foundation-form" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          {TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value="event">event:…</option>
        </select>
        {trigger === 'event' ? (
          <input className="foundation-form" placeholder="イベント名" value={eventName} onChange={(e) => setEventName(e.target.value)} />
        ) : null}
        <input className="foundation-form" placeholder="条件 (任意)" value={condition} onChange={(e) => setCondition(e.target.value)} />
        <button type="submit" className="primary" disabled={!to || createM.isPending || (trigger === 'event' && !eventName.trim())}>
          追加
        </button>
      </form>
      {createM.isError ? <div className="error">{errorText(createM.error)}</div> : null}
    </div>
  );
}
