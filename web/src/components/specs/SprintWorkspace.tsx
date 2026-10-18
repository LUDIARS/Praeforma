import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SPRINT_STAGE_LABELS } from '../../../../shared/spec-sprints.ts';
import { sprintApi } from '../../lib/spec-sprints-api.ts';
import { SprintCreateForm } from './SprintCreateForm.tsx';
import { SprintDetail } from './SprintDetail.tsx';

/** PF-SPRINT: bundle fragments, check them, and structure them once they come together. */
export function SprintWorkspace({ pid }: { pid: string }): React.ReactElement {
  const client = useQueryClient();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const query = useQuery({ queryKey: ['spec-sprints', pid], queryFn: () => sprintApi.list(pid) });
  const current = selected ?? query.data?.items[0]?.id ?? null;
  return <>
    <p>断片をスプリントにまとめて実装状態を確認し、まとまったらそのスプリントだけを体系化します。</p>
    {query.data?.canEdit && <div className="simple-actions">
      <button type="button" className="ghost" onClick={() => setCreating(!creating)}>{creating ? '作成を閉じる' : '新しいスプリント'}</button>
    </div>}
    {creating && <SprintCreateForm pid={pid} onCreated={async (sprint) => {
      setCreating(false); setSelected(sprint.id);
      await client.invalidateQueries({ queryKey: ['spec-sprints', pid] });
    }} />}
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">取得できませんでした。<button type="button" onClick={() => { void query.refetch(); }}>再取得</button></p>}
    {query.isSuccess && query.data.items.length === 0 && <p>スプリントはありません。</p>}
    {query.isSuccess && query.data.items.length > 0 && <div className="simple-actions" aria-label="スプリント">
      {query.data.items.map((sprint) => <button key={sprint.id} type="button" aria-pressed={sprint.id === current}
        className={sprint.id === current ? 'primary' : 'ghost'} onClick={() => setSelected(sprint.id)}>
        {sprint.title} ({SPRINT_STAGE_LABELS[sprint.stage]} {sprint.counts.implemented}/{sprint.counts.total})
      </button>)}
    </div>}
    {current && <SprintDetail key={current} pid={pid} sid={current} />}
  </>;
}
