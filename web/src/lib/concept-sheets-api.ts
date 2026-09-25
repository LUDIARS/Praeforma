// 企画概要書 API の呼び出しと、失敗の言い換え (spec/feature/concept-sheet.md)。
import { req, type ApiError } from './api.ts';
import type { ConceptSheetDocument, ConceptSheetRecord, ConceptSheetSummary } from '../../../shared/concept-sheet.ts';

const base = (pid: string): string => `/api/projects/${encodeURIComponent(pid)}/concept-sheets`;

export interface ConceptSheetList { canEdit: boolean; hasMore: boolean; items: ConceptSheetSummary[] }

export const conceptSheetApi = {
  list: (pid: string, offset = 0): Promise<ConceptSheetList> => req(`${base(pid)}?limit=100&offset=${offset}`),
  get: (pid: string, id: string): Promise<{ sheet: ConceptSheetRecord; canEdit: boolean }> =>
    req(`${base(pid)}/${encodeURIComponent(id)}`),
  /** keyVisual: data URL = 新しい画像 / 'keep' = 保存済みを使う / null = 使わない。 */
  generate: (pid: string, input: { id: string; expectedRevision: number; keyVisual: string | null }): Promise<{ id: string; revision: number }> =>
    req(`${base(pid)}/generate`, { method: 'POST', body: JSON.stringify(input) }),
  save: (pid: string, id: string, document: ConceptSheetDocument, expectedRevision: number): Promise<{ id: string; revision: number }> =>
    req(`${base(pid)}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ document, expectedRevision }) }),
  remove: (pid: string, id: string, expectedRevision: number): Promise<{ deleted: boolean }> =>
    req(`${base(pid)}/${encodeURIComponent(id)}?expectedRevision=${expectedRevision}`, { method: 'DELETE' }),
};

/** 利用者に見せる言葉へ。失敗しても入力は残っていることを伝える。 */
export function conceptSheetError(error: unknown): string {
  const e = error as ApiError;
  const code = (e.body as { error?: string } | undefined)?.error;
  if (code === 'concept_sheet_ux_empty') return 'UX/ゴールがまだ空です。「目指す体験」「体験の設計」「ゴール」のどれかを書いてから作ってください。';
  if (code === 'concept_sheet_insufficient_ux') return 'UX/ゴールの内容だけでは、体験の核を言い切れませんでした。UX/ゴールを書き足してから作り直してください。';
  if (code === 'concept_sheet_quality_check_failed') return '文の長さや形が企画概要書の決まりに収まりませんでした。もう一度作ってください。';
  if (code === 'concept_sheet_source_changed') return '作っている間に UX/ゴールが更新されました。最新の内容で作り直してください。';
  if (code === 'invalid_key_visual') return 'キービジュアルは PNG / JPEG / WebP の画像を選んでください。';
  if (code === 'key_visual_too_large' || e.status === 413) return 'キービジュアルが大きすぎます。4MB 以下の画像にしてください。';
  if (code === 'invalid_concept_sheet_document') return '空欄や文字数の上限、< > の記号を確認してください。入力は残っています。';
  if (e.status === 409) return '別の変更が保存されています。入力を控えてから、最新の内容を開き直してください。';
  if (e.status === 429) return '別の企画概要書を作成中です。少し待ってからやり直してください。';
  if (e.status === 503 || e.status === 504) return '企画概要書を書く AI を利用できないか、時間内に終わりませんでした。時間をおいてやり直してください。';
  if (e.status === 403) return 'この操作を行う権限がありません。';
  return '処理できませんでした。時間をおいてやり直してください。';
}
