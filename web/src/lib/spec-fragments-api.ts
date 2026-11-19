import { req } from './api.ts';
import type { FragmentInput, SpecFragment, ImplementationState } from '../../../shared/spec-fragments.ts';
import type { FragmentDispositionState } from '../../../shared/spec-versioning.ts';
import type { FragmentCounts } from '../../../shared/project-home.ts';

/** 1ページ件数。 リクエストの limit と画面のページ送り幅を必ず同じ値にする。 */
export const FRAGMENT_PAGE_SIZE = 30;

export const fragmentApi = {
  cleanupTodo: (pid: string) => req<{ pendingCount: number; canReconstruct: boolean }>(
    `/api/projects/${encodeURIComponent(pid)}/spec-fragments/cleanup-todo`),
  list: (pid: string, offset: number, disposition?: FragmentDispositionState) => req<{ items: SpecFragment[]; hasMore: boolean; canEdit: boolean }>(
    `/api/projects/${encodeURIComponent(pid)}/spec-fragments?limit=${FRAGMENT_PAGE_SIZE}&offset=${offset}${disposition ? `&disposition=${disposition}` : ''}`),
  /** 体系化の処理結果ごとの件数 (PF-HOME-12)。 */
  counts: (pid: string) => req<FragmentCounts>(`/api/projects/${encodeURIComponent(pid)}/spec-fragments/counts`),
  create: (pid: string, input: FragmentInput) => req<{ fragment: SpecFragment; replayed: boolean }>(
    `/api/projects/${encodeURIComponent(pid)}/spec-fragments`, { method: 'POST', body: JSON.stringify(input) }),
  implementation: (pid: string, id: string, input: { expectedRevision: number; implementationState: ImplementationState; implementationEvidence: string }) =>
    req<{ fragment: SpecFragment }>(`/api/projects/${encodeURIComponent(pid)}/spec-fragments/${encodeURIComponent(id)}/implementation`,
      { method: 'PATCH', body: JSON.stringify(input) }),
};
