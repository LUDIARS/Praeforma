import { req,type ApiError } from './api.ts';
import type { ReconstructionProposal,SpecVersionHead,SpecVersionLog } from '../../../shared/spec-versioning.ts';
const root=(pid:string)=>`/api/projects/${pid}/spec-versions`;
export const specVersionsApi={
  list:(pid:string,offset=0)=>req<{head:SpecVersionHead;version:string;canEdit:boolean;hasMore:boolean;logs:SpecVersionLog[]}>(`${root(pid)}?offset=${offset}`),
  pending:(pid:string)=>req<{proposal:ReconstructionProposal|null}>(`${root(pid)}/reconstructions`),
  generate:(pid:string)=>req<{proposal:ReconstructionProposal}>(`${root(pid)}/reconstructions`,{method:'POST'}),
  confirm:(pid:string,id:string)=>req<{version:string}>(`${root(pid)}/reconstructions/${id}/confirm`,{method:'POST'}),
  release:(pid:string,expectedRevision:number,note:string)=>req<{version:string}>(`${root(pid)}/releases`,{method:'POST',body:JSON.stringify({expectedRevision,note})}),
};
export function specVersionError(error:unknown):string {
  const e=error as ApiError;const code=(e.body as {error?:string}|undefined)?.error;
  if(code==='no_pending_fragments')return '未統合のフラグメントがありません。';
  if(code==='domain_required')return '先にドメインを登録してください。';
  if(code==='reconstruction_no_changes')return '統合できるフラグメントがないため、確定できませんでした。';
  if(e.status===409)return '元の仕様やバージョンが変わりました。最新の内容から案を作り直してください。';
  if(e.status===413)return '一度に扱える資料量を超えています。対象の整理が必要です。';
  if(e.status===403)return 'この操作を行う権限がありません。';
  return '処理できませんでした。AIの設定や入力を確認して、もう一度お試しください。';
}
