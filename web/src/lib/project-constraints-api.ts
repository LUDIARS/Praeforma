// 制約 API の呼び出しと、失敗の言い換え (spec/feature/project-constraints.md)。
import { req, type ApiError } from './api.ts';
import type { ConstraintKind, ProjectConstraint } from '../../../shared/project-constraint.ts';

const base = (pid: string): string => `/api/projects/${encodeURIComponent(pid)}/constraints`;

export interface ConstraintInput { kind: ConstraintKind; title: string; detail: string }

export const constraintApi = {
  list: (pid: string): Promise<{ canEdit: boolean; items: ProjectConstraint[] }> => req(base(pid)),
  create: (pid: string, input: ConstraintInput): Promise<{ constraint: ProjectConstraint }> =>
    req(base(pid), { method: 'POST', body: JSON.stringify(input) }),
  update: (pid: string, id: string, input: ConstraintInput, expectedRevision: number): Promise<{ constraint: ProjectConstraint }> =>
    req(`${base(pid)}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ ...input, expectedRevision }) }),
  remove: (pid: string, id: string, expectedRevision: number): Promise<{ deleted: boolean }> =>
    req(`${base(pid)}/${encodeURIComponent(id)}?expectedRevision=${expectedRevision}`, { method: 'DELETE' }),
};

/** 利用者に見せる言葉へ。失敗しても入力は残っていることを伝える。 */
export function constraintError(error: unknown): string {
  const e = error as ApiError;
  const code = (e.body as { error?: string } | undefined)?.error;
  if (code === 'invalid_constraint') return '見出し（1 行、80 字まで）と説明（4000 字まで）を確認してください。入力は残っています。';
  if (code === 'constraint_limit_reached') return '制約は 1 プロジェクト 200 件までです。';
  if (e.status === 409) return '別の変更が保存されています。入力は残しています。一覧を読み直してから、もう一度保存してください。';
  if (e.status === 404) return 'この制約はもうありません。一覧を読み直してください。';
  if (e.status === 403) return 'この操作を行う権限がありません。';
  return '保存を確認できませんでした。入力は残しています。時間をおいてやり直してください。';
}
