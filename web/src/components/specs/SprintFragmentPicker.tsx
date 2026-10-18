import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { sprintApi, sprintError } from '../../lib/spec-sprints-api.ts';
import { summarize } from './spec-block-summary.ts';

/** PF-SPRINT-8: pick pending fragments that belong to no sprint yet. */
export function SprintFragmentPicker({ pid, sid, onAdded }: {
  pid: string; sid: string; onAdded: () => Promise<void>;
}): React.ReactElement {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const query = useQuery({ queryKey: ['spec-sprint-unassigned', pid], queryFn: () => sprintApi.unassigned(pid) });
  const add = useMutation({
    mutationFn: () => sprintApi.addFragments(pid, sid, [...selected]),
    onSuccess: async () => { setSelected(new Set()); await onAdded(); },
  });
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  if (query.isPending) return <p role="status">読み込み中…</p>;
  if (query.isError) return <p role="alert">取得できませんでした。</p>;
  if (!query.data.items.length) return <p>スプリントに入っていない未体系化の断片はありません。</p>;
  return <form onSubmit={(event) => { event.preventDefault(); if (selected.size && !add.isPending) add.mutate(); }}>
    <fieldset className="fragment-fields" disabled={add.isPending}>
      {query.data.items.map((fragment) => <label key={fragment.id} className="sprint-pick">
        <input type="checkbox" checked={selected.has(fragment.id)} onChange={() => toggle(fragment.id)} />
        <span>{summarize(fragment.content)}</span>
      </label>)}
      <div><button type="submit" className="primary" disabled={!selected.size}>
        {add.isPending ? '追加中…' : `選んだ ${selected.size} 件を追加`}</button></div>
    </fieldset>
    {add.isError && <p role="alert">{sprintError(add.error)}</p>}
  </form>;
}
