import React from 'react';
import { useQuery,useMutation,useQueryClient } from '@tanstack/react-query';
import { specVersionsApi,specVersionError } from '../../lib/spec-versions-api.ts';
import { ReconstructionPreview } from './ReconstructionPreview.tsx';
import { SpecVersionHistory } from './SpecVersionHistory.tsx';
import { DomainProposalPanel } from '../domain-definitions/DomainProposalPanel.tsx';
import type { ReconstructionProposal } from '../../../../shared/spec-versioning.ts';
import '../../styles/spec-versions.css';
export function SpecVersionPanel({pid}:{pid:string}):React.ReactElement {
  const client=useQueryClient();const [offset,setOffset]=React.useState(0);const [proposal,setProposal]=React.useState<ReconstructionProposal|null>(null);const [note,setNote]=React.useState('');const [showRelease,setShowRelease]=React.useState(false);
  const query=useQuery({queryKey:['spec-versions',pid,offset],queryFn:()=>specVersionsApi.list(pid,offset)});
  const pending=useQuery({queryKey:['spec-reconstruction',pid],queryFn:()=>specVersionsApi.pending(pid),enabled:query.data?.canEdit===true});
  const refresh=async()=>{await Promise.all(['fragment-cleanup-todo','spec-versions','spec-reconstruction','specs','spec-fragments','domain-definitions'].map(key=>client.invalidateQueries({queryKey:[key,pid]})));};
  const generate=useMutation({mutationFn:()=>specVersionsApi.generate(pid),onSuccess:result=>{setProposal(result.proposal);}});
  const confirm=useMutation({mutationFn:(id:string)=>specVersionsApi.confirm(pid,id),onSuccess:async()=>{setProposal(null);client.setQueryData(['spec-reconstruction',pid],{proposal:null});setOffset(0);await refresh();}});
  const release=useMutation({mutationFn:()=>specVersionsApi.release(pid,query.data!.head.revision,note),onSuccess:async()=>{setNote('');setShowRelease(false);setOffset(0);await refresh();}});
  const current=proposal??pending.data?.proposal;const busy=generate.isPending||confirm.isPending||release.isPending;
  const error=generate.error??confirm.error??release.error??query.error;
  return <section className="spec-version-panel"><h4>仕様バージョン {query.data?.version??'…'}</h4>
    <p className="meta">追加でパッチ更新、再構築確定でマイナー更新、リリース記録でメジャー更新。</p>
    <DomainProposalPanel key={pid} pid={pid}/>
    {query.data?.canEdit?<div className="simple-actions"><button type="button" disabled={busy} onClick={()=>{confirm.reset();release.reset();generate.mutate();}}>{generate.isPending?'統合案を作成中…':'再構築'}</button><button type="button" className="ghost" disabled={busy} onClick={()=>setShowRelease(!showRelease)}>リリースを記録</button></div>:null}
    {error?<p role="alert" className="err-text">{specVersionError(error)}</p>:null}
    {showRelease?<div className="panel"><p>現在の仕様をリリースとして記録します。配布やデプロイは行いません。</p><textarea aria-label="リリース内容" value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/><button type="button" disabled={busy||!note.trim()} onClick={()=>{generate.reset();confirm.reset();release.mutate();}}>メジャーバージョンを上げて記録</button></div>:null}
    {current?<ReconstructionPreview proposal={current} disabled={busy||!query.data?.canEdit} onConfirm={()=>{generate.reset();release.reset();confirm.mutate(current.id);}}/>:null}
    <SpecVersionHistory logs={query.data?.logs??[]}/><div className="simple-actions"><button className="ghost" disabled={offset===0||query.isFetching} onClick={()=>setOffset(Math.max(0,offset-20))}>新しい履歴</button><button className="ghost" disabled={!query.data?.hasMore||query.isFetching} onClick={()=>setOffset(offset+20)}>古い履歴</button></div>
  </section>;
}
