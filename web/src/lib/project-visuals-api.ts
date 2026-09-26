// ビジュアル素材 API の呼び出しと、失敗の言い換え (spec/feature/project-visuals.md)。
import { req, type ApiError } from './api.ts';
import type { ProjectVisual, ProjectVisualWithImage, VisualKind } from '../../../shared/project-visual.ts';

const base = (pid: string): string => `/api/projects/${encodeURIComponent(pid)}/visuals`;

export interface VisualFieldsInput { kind: VisualKind; label: string; note: string; featured: boolean }
export interface VisualList { canEdit: boolean; max: number; items: ProjectVisual[] }

export const visualApi = {
  list: (pid: string): Promise<VisualList> => req(base(pid)),
  /** 画像の中身ごと 1 枚。中身は作成後に変わらないので、画面はこれを使い回してよい。 */
  get: (pid: string, id: string): Promise<{ visual: ProjectVisualWithImage }> => req(`${base(pid)}/${encodeURIComponent(id)}`),
  create: (pid: string, input: VisualFieldsInput & { dataUrl: string }): Promise<{ visual: ProjectVisual }> =>
    req(base(pid), { method: 'POST', body: JSON.stringify(input) }),
  update: (pid: string, id: string, input: VisualFieldsInput, expectedRevision: number): Promise<{ visual: ProjectVisual }> =>
    req(`${base(pid)}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ ...input, expectedRevision }) }),
  remove: (pid: string, id: string, expectedRevision: number): Promise<{ deleted: boolean }> =>
    req(`${base(pid)}/${encodeURIComponent(id)}?expectedRevision=${expectedRevision}`, { method: 'DELETE' }),
};

/** 利用者に見せる言葉へ。失敗しても入力は残っていることを伝える。 */
export function visualError(error: unknown): string {
  const e = error as ApiError;
  const code = (e.body as { error?: string } | undefined)?.error;
  if (code === 'visual_limit_reached') return 'ビジュアルは 1 プロジェクト 30 枚までです。使わないものを削除してから登録してください。';
  if (code === 'invalid_scene_image') return '画像は PNG / JPEG / WebP を選んでください。';
  if (code === 'scene_image_too_large' || e.status === 413) return '画像が大きすぎます。1 枚 4MB 以下にしてください。';
  if (code === 'invalid_visual') return '名前（1 行、60 字まで）とメモ（1000 字まで）を確認してください。入力は残っています。';
  if (e.status === 409) return '別の変更が保存されています。入力は残しています。一覧を読み直してから、もう一度保存してください。';
  if (e.status === 404) return 'このビジュアルはもうありません。一覧を読み直してください。';
  if (e.status === 403) return 'この操作を行う権限がありません。';
  return '保存を確認できませんでした。入力は残しています。時間をおいてやり直してください。';
}
