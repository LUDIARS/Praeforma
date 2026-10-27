import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SPRINT_STAGE_LABELS } from '../../../../shared/spec-sprints.ts';
import { sprintApi, sprintError } from '../../lib/spec-sprints-api.ts';
import { specVersionsApi, specVersionError } from '../../lib/spec-versions-api.ts';
import { FragmentCard } from './FragmentCard.tsx';
import { SprintFragmentPicker } from './SprintFragmentPicker.tsx';
import { SprintProposalDecision } from './SprintProposalDecision.tsx';

/** PF-SPRINT-3/5/6/9: check the sprint's fragments, structure only this sprint and decide its proposal here. */
export function SprintDetail({ pid, sid }: { pid: string; sid: string }): React.ReactElement {
  const client = useQueryClient();
  const [picking, setPicking] = React.useState(false);
  const query = useQuery({ queryKey: ['spec-sprint', pid, sid], queryFn: () => sprintApi.detail(pid, sid) });
  const [decided, setDecided] = React.useState<string | null>(null);
  const canReconstruct = query.data?.canReconstruct === true;
  const proposal = useQuery({ queryKey: ['spec-sprint-proposal', pid, sid], queryFn: () => specVersionsApi.sprintPending(pid, sid), enabled: canReconstruct });
  const refresh = async (): Promise<void> => {
    await Promise.all(['spec-sprints', 'spec-sprint', 'spec-sprint-unassigned', 'spec-sprint-proposal', 'spec-fragments', 'fragment-cleanup-todo',
      'spec-reconstruction', 'spec-versions', 'specs']
      .map((key) => client.invalidateQueries({ queryKey: [key, pid] })));
  };
  const remove = useMutation({ mutationFn: (fid: string) => sprintApi.removeFragment(pid, sid, fid), onSuccess: refresh });
  const structure = useMutation({
    mutationFn: () => specVersionsApi.generate(pid, sid),
    onSuccess: ({ proposal: created }) => {
      setDecided(null);
      client.setQueryData(['spec-sprint-proposal', pid, sid], { proposal: created });
    },
  });
  if (query.isPending) return <p role="status">読み込み中…</p>;
  if (query.isError) return <p role="alert">取得できませんでした。<button type="button" onClick={() => { void query.refetch(); }}>再取得</button></p>;
  const { sprint, fragments, canEdit } = query.data;
  const current = proposal.data?.proposal ?? null;
  const { counts } = sprint;
  const pending = counts.total - counts.reconstructed;
  return <section className="sprint-detail">
    <h4>{sprint.title} <span className="meta">{SPRINT_STAGE_LABELS[sprint.stage]}</span></h4>
    {sprint.goal && <p className="fragment-content">{sprint.goal}</p>}
    <p className="meta">全 {counts.total} 件 / 実装済 {counts.implemented} / 未実装 {counts.unimplemented} / 未確認 {counts.unverified} / 体系化済 {counts.reconstructed}</p>
    {canReconstruct && pending > 0 && <div className="simple-actions">
      <button type="button" className={sprint.stage === 'ready' ? 'primary' : 'ghost'} disabled={structure.isPending}
        onClick={() => structure.mutate()}>{structure.isPending ? '統合案を作成中…' : current ? '体系化案を作り直す' : 'このスプリントを体系化'}</button>
      {sprint.stage !== 'ready' && <span className="meta">実装済でない断片が {counts.pendingNotImplemented} 件あります。体系化はできますが、まとまってから行うのが目安です。</span>}
    </div>}
    {structure.isError && <p role="alert">{specVersionError(structure.error)}</p>}
    {decided && <p role="status">決定を反映しました（{decided}）。</p>}
    {current && <SprintProposalDecision key={current.id} pid={pid} proposal={current}
      onDecided={async (version) => { setDecided(version); await refresh(); }} />}
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
