// 企画概要書 API の呼び出しと、失敗の言い換え (spec/feature/concept-sheet.md)。
import { req, type ApiError } from './api.ts';
import type { ConceptSheetRecord, ConceptSheetSummary } from '../../../shared/concept-sheet.ts';

const base = (pid: string): string => `/api/projects/${encodeURIComponent(pid)}/concept-sheets`;

export interface ConceptSheetList { canEdit: boolean; hasMore: boolean; items: ConceptSheetSummary[] }
export type ConceptSheetJob =
  | { sheetId: string; state: 'running'; startedAt: string }
  | { sheetId: string; state: 'failed'; startedAt: string; finishedAt: string; error: string };
export interface SceneImageInput { label: string; dataUrl: string }

export const conceptSheetApi = {
  list: (pid: string, offset = 0): Promise<ConceptSheetList> => req(`${base(pid)}?limit=100&offset=${offset}`),
  get: (pid: string, id: string): Promise<{ sheet: ConceptSheetRecord; canEdit: boolean }> =>
    req(`${base(pid)}/${encodeURIComponent(id)}`),
  /** 受け付けだけを返す (202)。できあがりは generation() で待つ。images: 新しい候補 / 'keep' = 保存済みの候補。 */
  generate: (pid: string, input: { id: string; expectedRevision: number; images: SceneImageInput[] | 'keep'; instructions: string }):
    Promise<{ id: string; state: 'running' }> => req(`${base(pid)}/generate`, { method: 'POST', body: JSON.stringify(input) }),
  generation: (pid: string): Promise<{ job: ConceptSheetJob | null }> => req(`${base(pid)}/generation`),
  remove: (pid: string, id: string, expectedRevision: number): Promise<{ deleted: boolean }> =>
    req(`${base(pid)}/${encodeURIComponent(id)}?expectedRevision=${expectedRevision}`, { method: 'DELETE' }),
};

const MESSAGES: Record<string, string> = {
  concept_sheet_ux_empty: 'UX/ゴールがまだ空です。「目指す体験」「体験の設計」「ゴール」のどれかを書いてから作ってください。',
  concept_sheet_insufficient_ux: 'UX/ゴールの内容だけでは、体験の核を言い切れませんでした。UX/ゴールを書き足してから作り直してください。',
  concept_sheet_quality_check_failed: 'できた紙面が決まり（キャッチコピーをそのまま載せる・シーン名を書く・安全な HTML）を満たしませんでした。もう一度作ってください。',
  concept_sheet_source_changed: '作っている間に UX/ゴール（キャッチコピーを含む）が更新されました。最新の内容で作り直してください。',
  concept_sheet_generation_busy: '別の企画概要書を作成中です。終わってからやり直してください。',
  invalid_scene_image: '画面の画像は PNG / JPEG / WebP を選んでください。',
  scene_image_too_large: '画面の画像が大きすぎます。1 枚 4MB 以下にしてください。',
  scene_images_too_large: '画面の画像が大きすぎます。合計 16MB 以下にしてください。',
  scene_images_required: '画面の画像を 1 枚以上選んでください。',
  astra_unavailable: '企画概要書をデザインする AI (Astra) を呼び出せませんでした。サーバの Codex CLI の導入とログインを確認してください。',
  astra_failed: '企画概要書をデザインする AI (Astra) が途中で止まりました。時間をおいてやり直してください。',
  astra_no_output: '企画概要書をデザインする AI (Astra) から結果が返りませんでした。時間をおいてやり直してください。',
  astra_timeout: '企画概要書のデザインが時間内に終わりませんでした。画面の枚数を減らすか、時間をおいてやり直してください。',
  concept_sheet_revision_conflict: '別の変更が保存されています。最新の内容を開き直してください。',
};

/** 生成の状態に残った失敗コードを、利用者に見せる言葉へ。 */
export function conceptSheetJobError(code: string): string {
  return MESSAGES[code] ?? '企画概要書を作れませんでした。時間をおいてやり直してください。';
}

/** 利用者に見せる言葉へ。失敗しても入力は残っていることを伝える。 */
export function conceptSheetError(error: unknown): string {
  const e = error as ApiError;
  const code = (e.body as { error?: string } | undefined)?.error;
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (e.status === 413) return MESSAGES.scene_images_too_large!;
  if (e.status === 409) return MESSAGES.concept_sheet_revision_conflict!;
  if (e.status === 429) return MESSAGES.concept_sheet_generation_busy!;
  if (e.status === 403) return 'この操作を行う権限がありません。';
  return '処理できませんでした。時間をおいてやり直してください。';
}
