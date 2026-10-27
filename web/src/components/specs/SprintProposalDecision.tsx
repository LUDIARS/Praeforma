import React from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ReconstructionProposal } from '../../../../shared/spec-versioning.ts';
import { nextSpecVersion, versionLabel } from '../../../../shared/spec-versioning.ts';
import { specVersionsApi, specVersionError } from '../../lib/spec-versions-api.ts';
import '../../styles/spec-versions.css';

type Choice = { reject: boolean; reason: string };

/** PF-SPRINT-9: decide each change of the sprint's proposal (confirm or reject with a reason), then commit once. */
export function SprintProposalDecision({ pid, proposal, onDecided }: {
  pid: string; proposal: ReconstructionProposal; onDecided: (version: string) => Promise<void>;
}): React.ReactElement {
  const [choices, setChoices] = React.useState<Record<number, Choice>>({});
  const { material, plan } = proposal;
  const choiceOf = (index: number): Choice => choices[index] ?? { reject: false, reason: '' };
  const update = (index: number, next: Partial<Choice>): void => setChoices({ ...choices, [index]: { ...choiceOf(index), ...next } });
  const rejectedIndexes = plan.changes.map((_, index) => index).filter((index) => choiceOf(index).reject);
  const accepted = plan.changes.length - rejectedIndexes.length;
  const missingReason = rejectedIndexes.some((index) => !choiceOf(index).reason.trim());
  const nothing = !plan.changes.length && !plan.rejected?.length;
  const decide = useMutation({
    mutationFn: () => specVersionsApi.decide(pid, proposal.id,
      { rejectedChanges: rejectedIndexes.map((index) => ({ index, reason: choiceOf(index).reason.trim() })) }),
    onSuccess: async ({ version }) => { setChoices({}); await onDecided(version); },
  });
  const content = (id: string): string => material.fragments.find((fragment) => fragment.id === id)?.content ?? '';
  return <section className="panel spec-version-panel sprint-proposal">
    <h4>このスプリントの体系化案</h4>
    <p className="meta">変更ごとに確定か棄却を選び、最後にまとめて反映します。反映すると {versionLabel(nextSpecVersion(material.head, 'minor'))} になります。
      棄却した変更の出典断片は、理由付きで棄却として記録され、原文は残ります。</p>
    {plan.changes.map((change, index) => {
      const before = material.specs.find((spec) => spec.id === change.specId);
      const choice = choiceOf(index);
      return <article className={`spec-reconstruction-change${choice.reject ? ' is-rejected' : ''}`} key={index}>
        <h4>{before ? '更新' : '追加'}: {change.title}</h4>
        <p className="meta">ドメイン: {material.domains.find((domain) => domain.id === change.domainId)?.name}</p>
        <p>{change.rationale}</p>
        <details><summary>{before ? '変更前と変更後' : '仕様の全文'}</summary>
          {before ? <div className="spec-version-diff"><div><strong>変更前</strong><pre>{before.title}{'\n'}{before.description ?? ''}</pre></div>
            <div><strong>変更後</strong><pre>{change.title}{'\n'}{change.description}</pre></div></div>
            : <pre>{change.description}</pre>}
        </details>
        <details><summary>出典断片（{change.fragmentIds.length}件）</summary>{change.fragmentIds.map((id) => <pre key={id}>{content(id)}</pre>)}</details>
        <fieldset className="sprint-proposal-choice" disabled={decide.isPending}>
          <label><input type="radio" name={`decision-${proposal.id}-${index}`} checked={!choice.reject} onChange={() => update(index, { reject: false })} /> 確定</label>
          <label><input type="radio" name={`decision-${proposal.id}-${index}`} checked={choice.reject} onChange={() => update(index, { reject: true })} /> 棄却</label>
        </fieldset>
        {choice.reject && <textarea aria-label={`${change.title} の棄却理由`} placeholder="棄却の理由 (必須)" maxLength={2000}
          value={choice.reason} onChange={(event) => update(index, { reason: event.target.value })} />}
      </article>;
    })}
    {plan.deferred.length > 0 && <details><summary>保留する断片（{plan.deferred.length}件）</summary>
      <p className="meta">保留した断片は未処理のまま残り、次の体系化で扱います。</p>
      {plan.deferred.map((item) => <div key={item.fragmentId}><p>{item.reason}</p><pre>{content(item.fragmentId)}</pre></div>)}</details>}
    {(plan.rejected?.length ?? 0) > 0 && <details><summary>案の段階で棄却されている断片（{plan.rejected!.length}件）</summary>
      {plan.rejected!.map((item) => <div key={item.fragmentId}><p>{item.reason}</p><pre>{content(item.fragmentId)}</pre></div>)}</details>}
    {decide.isError && <p role="alert" className="err-text">{specVersionError(decide.error)}</p>}
    <div className="simple-actions">
      <button type="button" className="primary" disabled={decide.isPending || missingReason || nothing} onClick={() => decide.mutate()}>
        {decide.isPending ? '反映中…' : `決定を反映する（確定 ${accepted} 件 / 棄却 ${rejectedIndexes.length} 件）`}</button>
      {missingReason && <span className="meta">棄却する変更には理由を書いてください。</span>}
    </div>
  </section>;
}
