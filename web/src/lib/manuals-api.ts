import { req, type ApiError } from './api.ts';
import type { ManualRecord, ManualDocument } from '../../../shared/feature-manual.ts';
export type ManualView = Omit<ManualRecord,'source'|'proposal'|'publishedSource'> & Partial<Pick<ManualRecord,'source'|'proposal'|'publishedSource'>>;
export const manualApi = {
  list: (pid:string,offset=0) => req<{canEdit:boolean;hasMore:boolean;items:Array<{id:string;title:string;published:boolean}>}>(`/api/projects/${pid}/manuals?limit=100&offset=${offset}`),
  sources: (pid:string,offset=0,kind='spec') => req<{items:Array<{id:string;title:string}>;hasMore:boolean}>(`/api/projects/${pid}/manuals/sources?limit=100&offset=${offset}&kind=${kind}`),
  get: (pid:string,id:string) => req<{manual:ManualView;canEdit:boolean}>(`/api/projects/${pid}/manuals/${id}`),
  generate: (pid:string,input:unknown) => req<{id:string}>(`/api/projects/${pid}/manuals/generate`,{method:'POST',body:JSON.stringify(input)}),
  save: (pid:string,id:string,document:ManualDocument,basis:'saved'|'proposal',expectedRevision:number) =>
    req(`/api/projects/${pid}/manuals/${id}`,{method:'PUT',body:JSON.stringify({document,basis,expectedRevision})}),
};
export function manualError(error:unknown): string {
  const e=error as ApiError;
  const code=(e.body as {error?:string}|undefined)?.error;
  if(code==='manual_quality_check_failed') return '説明に必要な情報が足りないか、言葉・図の確認を通過できませんでした。資料を見直してください。';
  if(code==='invalid_manual_document') return '説明文や図の空欄・長さ・言葉を確認してください。入力は残っています。';
  if(code==='manual_source_changed') return '元の仕様が変わりました。最新の内容から作り直してください。入力は残っています。';
  if(e.status===409) return '別の変更が保存されています。入力を控えてから最新の内容を開いてください。';
  if(e.status===429) return '別の説明書を作成中です。少し待ってからやり直してください。';
  if(e.status===503) return '説明書を書くAIを利用できません。管理者に設定の確認を依頼してください。';
  if(e.status===403) return 'この操作を行う権限がありません。';
  return '処理できませんでした。入力を残しています。時間をおいてやり直してください。';
}
