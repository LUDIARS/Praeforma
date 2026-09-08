import React from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {api,req,type ApiError} from '../../lib/api.ts';
import type {DomainProposalMaterial,BusinessDomainCandidate} from '../../../../shared/domain-proposals.ts';
export function DomainProposalPanel({pid}:{pid:string}):React.ReactElement {
  const client=useQueryClient();const [includeAnatomia,setIncludeAnatomia]=React.useState(false);const [registered,setRegistered]=React.useState<string[]>([]);
  const scan=useMutation({mutationFn:()=>req<{material:DomainProposalMaterial}>(`/api/projects/${pid}/domain-proposals?includeAnatomia=${includeAnatomia}`)});
  const propose=useMutation({mutationFn:()=>req<{material:DomainProposalMaterial;candidates:BusinessDomainCandidate[]}>(`/api/projects/${pid}/domain-proposals`,{method:'POST',body:JSON.stringify({includeAnatomia})})});
  const register=useMutation({mutationFn:(candidate:BusinessDomainCandidate)=>api.createDomain(pid,{name:candidate.name,description:candidate.responsibility,definition:{kind:'business',value:candidate.value}}),onSuccess:async(result)=>{setRegistered(current=>[...current,result.domain.name]);await Promise.all([client.invalidateQueries({queryKey:['domain-definitions',pid]}),client.invalidateQueries({queryKey:['domains',pid]})]);}});
  const material=propose.data?.material??scan.data?.material;const busy=scan.isPending||propose.isPending||register.isPending;
  const error=scan.error??propose.error??register.error;const code=((error as ApiError|undefined)?.body as {error?:string}|undefined)?.error;
  return <details className="panel"><summary>未登録ドメイン・ビジネスドメインの提案</summary><p>仕様とフラグメントを調べ、コアドメインと対比して登録候補を提案します。</p>
    <label><input type="checkbox" checked={includeAnatomia} disabled={busy} onChange={e=>{setIncludeAnatomia(e.target.checked);scan.reset();propose.reset();}}/>Anatomiaのドメインも照合する</label>
    <div className="simple-actions"><button type="button" disabled={busy} onClick={()=>{propose.reset();register.reset();scan.mutate();}}>登録状況を確認</button><button type="button" disabled={busy} onClick={()=>{scan.reset();register.reset();propose.mutate();}}>{propose.isPending?'提案を作成中…':'ビジネスドメインを提案'}</button></div>
    {error?<p role="alert">{code==='core_domain_required'?'対比するコアドメインを先に登録してください。':code==='anatomia_repo_unset'?'Anatomiaのプロジェクト連携が未設定です。':(error as ApiError).status===403?'提案・登録にはオーナーまたは企画者の権限が必要です。':'処理できませんでした。資料や接続設定を確認してください。'}</p>:null}
    {material?<><h4>対比するコアドメイン</h4><ul>{material.registered.filter(domain=>domain.kind==='core').map(domain=><li key={domain.id}><strong>{domain.name}</strong> — {domain.value||domain.description}</li>)}</ul>
      {material.includesAnatomia?<><h4>Anatomiaにあり、Pfでは未登録</h4><ul>{material.unregistered.map(domain=><li key={domain.name}>{domain.name} — {domain.description}</li>)}</ul>{!material.unregistered.length?<p>未登録ドメインはありません。</p>:null}</>:<p className="meta">Anatomiaは照合対象に含めていません。</p>}
    </>:null}
    {propose.data?<><h4>未登録のビジネスドメイン候補</h4>{!propose.data.candidates.length?<p>根拠のある追加候補はありません。</p>:null}{propose.data.candidates.map(candidate=><article className="panel" key={candidate.name}><h4>{candidate.name}</h4><p>{candidate.responsibility}</p><p>価値: {candidate.value}</p>
      {candidate.coreComparisons.map(core=><p key={core.coreId}><strong>{material?.registered.find(domain=>domain.id===core.coreId)?.name}</strong>との関係: {core.relationship}<br/>分ける理由: {core.difference}</p>)}
      <details><summary>提案の根拠</summary>{candidate.sourceRefs.map(ref=><p key={ref}>{material?.sources.find(source=>source.ref===ref)?.content}</p>)}</details>
      <button disabled={busy||registered.includes(candidate.name)} type="button" onClick={()=>register.mutate(candidate)}>{registered.includes(candidate.name)?'登録済み':'ビジネスドメインとして登録'}</button>
    </article>)}</>:null}
  </details>;
}
