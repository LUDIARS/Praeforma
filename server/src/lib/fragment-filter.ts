// 断片を体系化の処理結果で絞り込む (spec/feature/spec-review-home.md PF-HOME-12)。
// 処理結果は spec_reconstruction_fragments にあり、行が無い断片が保留中。ページ送りの前に絞る。

import type { FragmentCounts } from '../../../shared/project-home.ts';
import type { FragmentDispositionState } from '../../../shared/spec-versioning.ts';
import { versionRows } from '../db/spec-version-store.ts';
export { parseDisposition } from './fragment-disposition-param.ts';

const CONDITIONS: Record<FragmentDispositionState, string> = {
  pending: 'NOT EXISTS (SELECT 1 FROM spec_reconstruction_fragments r WHERE r.fragment_id=f.id)',
  integrated: `EXISTS (SELECT 1 FROM spec_reconstruction_fragments r WHERE r.fragment_id=f.id AND r.disposition<>'rejected')`,
  rejected: `EXISTS (SELECT 1 FROM spec_reconstruction_fragments r WHERE r.fragment_id=f.id AND r.disposition='rejected')`,
};

/** 新しい順の 1 ページ分の断片 id。limit+1 件まで返すので、呼び出し側で続きの有無を判定する。 */
export async function filteredFragmentIds(projectId: string, disposition: FragmentDispositionState, limit: number, offset: number): Promise<string[]> {
  const rows = await versionRows(`SELECT f.id FROM spec_fragments f WHERE f.project_id=? AND ${CONDITIONS[disposition]}
    ORDER BY f.created_at DESC, f.id DESC LIMIT ? OFFSET ?`, [projectId, limit + 1, offset]);
  return rows.map((row) => String(row.id));
}

export async function countFragmentsByDisposition(projectId: string): Promise<FragmentCounts> {
  const [row] = await versionRows(`SELECT
    SUM(CASE WHEN r.fragment_id IS NULL THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN r.fragment_id IS NOT NULL AND r.disposition<>'rejected' THEN 1 ELSE 0 END) AS integrated,
    SUM(CASE WHEN r.disposition='rejected' THEN 1 ELSE 0 END) AS rejected
    FROM spec_fragments f LEFT JOIN spec_reconstruction_fragments r ON r.fragment_id=f.id WHERE f.project_id=?`, [projectId]);
  return { pending: Number(row?.pending ?? 0), integrated: Number(row?.integrated ?? 0), rejected: Number(row?.rejected ?? 0) };
}
