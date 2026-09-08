import React from 'react';
import type { ReconstructionProposal } from '../../../../shared/spec-versioning.ts';
import { nextSpecVersion,versionLabel } from '../../../../shared/spec-versioning.ts';
export function ReconstructionPreview({proposal,disabled,onConfirm}:{proposal:ReconstructionProposal;disabled:boolean;onConfirm:()=>void}):React.ReactElement {
  return <section className="panel"><h4>レコンストラクション案</h4><p>確定すると {versionLabel(nextSpecVersion(proposal.material.head,'minor'))} になります。元のフラグメントは記録として残ります。</p>
    {proposal.plan.changes.map((change,index)=>{
      const before=proposal.material.specs.find(spec=>spec.id===change.specId);
      return <article className="spec-reconstruction-change" key={index}><h4>{before?'更新':'追加'}: {change.title}</h4><p>{change.rationale}</p>
        <p>ドメイン: {proposal.material.domains.find(domain=>domain.id===change.domainId)?.name}</p>
        <div className="spec-version-diff"><div><strong>変更前</strong><pre>{before?`${before.title}\n${before.description??''}`:'新しい仕様'}</pre></div><div><strong>変更後</strong><pre>{change.title}{'\n'}{change.description}</pre></div></div>
        <details><summary>出典フラグメント（{change.fragmentIds.length}件）</summary>{change.fragmentIds.map(id=><pre key={id}>{proposal.material.fragments.find(fragment=>fragment.id===id)?.content}</pre>)}</details>
      </article>;
    })}
    {proposal.plan.deferred.length?<details open><summary>保留するフラグメント</summary>{proposal.plan.deferred.map(item=><div key={item.fragmentId}><p>{item.reason}</p><pre>{proposal.material.fragments.find(fragment=>fragment.id===item.fragmentId)?.content}</pre></div>)}</details>:null}
    <button type="button" disabled={disabled||!proposal.plan.changes.length} onClick={onConfirm}>この内容で確定する</button>
  </section>;
}
