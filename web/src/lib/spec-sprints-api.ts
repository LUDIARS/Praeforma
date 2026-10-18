import { req, type ApiError } from './api.ts';
import type { SpecSprint, SprintFragment, SprintInput } from '../../../shared/spec-sprints.ts';

const root = (pid: string) => `/api/projects/${encodeURIComponent(pid)}/spec-sprints`;
interface Permissions { canEdit: boolean; canReconstruct: boolean }

export const sprintApi = {
  list: (pid: string) => req<{ items: SpecSprint[] } & Permissions>(root(pid)),
  detail: (pid: string, sid: string) =>
    req<{ sprint: SpecSprint; fragments: SprintFragment[] } & Permissions>(`${root(pid)}/${encodeURIComponent(sid)}`),
  unassigned: (pid: string) => req<{ items: SprintFragment[] }>(`${root(pid)}/unassigned`),
  create: (pid: string, input: SprintInput) =>
    req<{ sprint: SpecSprint }>(root(pid), { method: 'POST', body: JSON.stringify(input) }),
  addFragments: (pid: string, sid: string, fragmentIds: string[]) =>
    req<{ sprint: SpecSprint }>(`${root(pid)}/${encodeURIComponent(sid)}/fragments`, { method: 'POST', body: JSON.stringify({ fragmentIds }) }),
  removeFragment: (pid: string, sid: string, fid: string) =>
    req<{ sprint: SpecSprint }>(`${root(pid)}/${encodeURIComponent(sid)}/fragments/${encodeURIComponent(fid)}`, { method: 'DELETE' }),
};

export function sprintError(error: unknown): string {
  const e = error as ApiError;
  const code = (e.body as { error?: string } | undefined)?.error;
  if (code === 'fragment_in_other_sprint') return '別のスプリントに入っている断片が含まれています。';
  if (code === 'fragment_already_structured') return '体系化済の断片は外せません。';
  if (code === 'sprint_not_found' || code === 'fragment_not_found') return '対象が見つかりません。最新の一覧を確認してください。';
  if (e.status === 403) return 'この操作を行う権限がありません。';
  return '処理できませんでした。入力は残っています。';
}
