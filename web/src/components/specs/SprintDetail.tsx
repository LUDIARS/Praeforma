import React from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SPRINT_STAGE_LABELS } from '../../../../shared/spec-sprints.ts';
import { sprintApi, sprintError } from '../../lib/spec-sprints-api.ts';
import { specVersionsApi, specVersionError } from '../../lib/spec-versions-api.ts';
import { FragmentCard } from './FragmentCard.tsx';
import { SprintFragmentPicker } from './SprintFragmentPicker.tsx';

/** PF-SPRINT-3/5/6: check the sprint's fragments and structure only this sprint. */
export function SprintDetail({ pid, sid }: { pid: string; sid: string }): React.ReactElement {
  const client = useQueryClient();
  const [, setSearch] = useSearchParams();
  const [picking, setPicking] = React.useState(false);
  const query = useQuery({ queryKey: ['spec-sprint', pid, sid], queryFn: () => sprintApi.detail(pid, sid) });
  const refresh = async (): Promise<void> => {
    await Promise.all(['spec-sprints', 'spec-sprint', 'spec-sprint-unassigned', 'spec-fragments', 'fragment-cleanup-todo']
      .map((key) => client.invalidateQueries({ queryKey: [key, pid] })));
  };
  const remove = useMutation({ mutationFn: (fid: string) => sprintApi.removeFragment(pid, sid, fid), onSuccess: refresh });
  const structure = useMutation({
    mutationFn: () => specVersionsApi.generate(pid, sid),
    onSuccess: ({ proposal }) => {
      // The proposal is reviewed and confirmed in the existing reconstruction panel.
      client.setQueryData(['spec-reconstruction', pid], { proposal });
      setSearch((current) => { const next = new URLSearchParams(current); next.set('reconstruct', '1'); return next; });
    },
  });
  if (query.isPending) return <p role="status">読み込み中…</p>;
  if (query.isError) return <p role="alert">取得できませんでした。<button type="button" onClick={() => { void query.refetch(); }}>再取得</button></p>;
  const { sprint, fragments, canEdit, canReconstruct } = query.data;
  const { counts } = sprint;
  const pending = counts.total - counts.reconstructed;
  return <section className="sprint-detail">
    <h4>{sprint.title} <span className="meta">{SPRINT_STAGE_LABELS[sprint.stage]}</span></h4>
    {sprint.goal && <p className="fragment-content">{sprint.goal}</p>}
    <p className="meta">全 {counts.total} 件 / 実装済 {counts.implemented} / 未実装 {counts.unimplemented} / 未確認 {counts.unverified} / 体系化済 {counts.reconstructed}</p>
    {canReconstruct && pending > 0 && <div className="simple-actions">
      <button type="button" className={sprint.stage === 'ready' ? 'primary' : 'ghost'} disabled={structure.isPending}
        onClick={() => structure.mutate()}>{structure.isPending ? '統合案を作成中…' : 'このスプリントを体系化'}</button>
      {sprint.stage !== 'ready' && <span className="meta">実装済でない断片が {counts.pendingNotImplemented} 件あります。体系化はできますが、まとまってから行うのが目安です。</span>}
    </div>}
    {structure.isError && <p role="alert">{specVersionError(structure.error)}</p>}
    {structure.isSuccess && <p role="status">統合案を作成しました。上の「再構築」で内容を確認して確定してください。</p>}
    {canEdit && <div className="simple-actions"><button type="button" className="ghost" onClick={() => setPicking(!picking)}>
      {picking ? '断片の追加を閉じる' : '断片を追加'}</button></div>}
    {picking && <SprintFragmentPicker pid={pid} sid={sid} onAdded={async () => { setPicking(false); await refresh(); }} />}
    {remove.isError && <p role="alert">{sprintError(remove.error)}</p>}
    {fragments.length === 0 && <p>このスプリントに断片はありません。</p>}
    {fragments.map((fragment) => <div key={fragment.id}>
      <FragmentCard fragment={fragment} canEdit={canEdit} onChanged={refresh} />
      <div className="fragment-meta">
        {fragment.reconstructed ? <span>体系化済</span>
          : canEdit && <button type="button" className="ghost" disabled={remove.isPending}
            onClick={() => remove.mutate(fragment.id)}>スプリントから外す</button>}
      </div>
    </div>)}
  </section>;
}
