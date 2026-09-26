// 自動更新の対象を探す (spec/feature/concept-sheet.md PF-CS-11)。自動更新 ON で、材料が変わって古くなったシート。
// 自動更新の予約 (concept-sheet-auto-update.ts) が DB を直に読まないよう、ここに分ける。
import { listAutoUpdateSheetRows } from '../db/concept-sheet-reads.ts';
import { readFreshnessBasis, freshnessOf } from './concept-sheet-freshness.ts';
import { AppError } from './errors.ts';

/** そのプロジェクトの、自動更新 ON で古くなったシート (古く作った順)。 */
export async function findOutdatedAutoSheets(projectId: string): Promise<string[]> {
  const rows = await listAutoUpdateSheetRows(projectId);
  if (rows.length === 0) return [];
  const basis = await readFreshnessBasis(projectId, rows.flatMap((r) => r.payload.visualRefs ?? []));
  return rows.filter((r) => freshnessOf(r.payload.source, r.payload.visualRefs ?? [], basis) === 'outdated').map((r) => r.id);
}

/** 自動更新 ON で古くなったシートを持つプロジェクト。削除済みのプロジェクトは飛ばす。 */
export async function findProjectsWithOutdatedAutoSheets(): Promise<string[]> {
  const projectIds = [...new Set((await listAutoUpdateSheetRows()).map((r) => r.projectId))];
  const outdated: string[] = [];
  for (const projectId of projectIds) {
    try {
      if ((await findOutdatedAutoSheets(projectId)).length > 0) outdated.push(projectId);
    } catch (error) {
      if (!(error instanceof AppError && error.status === 404)) throw error;
    }
  }
  return outdated;
}
