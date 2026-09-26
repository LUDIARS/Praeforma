// @spec PF-ACC-SUM-2 応答
// 受入状態の要約の読み取り (spec/feature/acceptance-summary.md)。集計は lib/acceptance-summary.ts。
// ローカルモード (SQLite) は受入テーブルを持たないため run 0 件として返す。
import { asc, eq } from 'drizzle-orm';
import { getDb, getLocalSqlite } from './connection.ts';
import { acceptanceRuns, acceptanceResults } from './schema/acceptance.ts';
import { versionRows } from './spec-version-store.ts';
import type { AcceptanceResultRow, AcceptanceRunRow, SpecVersionHead } from '../lib/acceptance-summary.ts';

/** run の状態と時刻だけ (triggered_by / summary は読まない)。 */
export async function readAcceptanceRuns(projectId: string): Promise<AcceptanceRunRow[]> {
  if (getLocalSqlite()) return [];
  return getDb()
    .select({
      id: acceptanceRuns.id,
      status: acceptanceRuns.status,
      startedAt: acceptanceRuns.startedAt,
      finishedAt: acceptanceRuns.finishedAt,
    })
    .from(acceptanceRuns)
    .where(eq(acceptanceRuns.projectId, projectId))
    .orderBy(asc(acceptanceRuns.startedAt));
}

/** 結果の状態だけ (observed / error_message / log_excerpt は読まない)。 */
export async function readAcceptanceResultStatuses(runId: string): Promise<AcceptanceResultRow[]> {
  if (getLocalSqlite()) return [];
  return getDb()
    .select({ status: acceptanceResults.status })
    .from(acceptanceResults)
    .where(eq(acceptanceResults.runId, runId));
}

export async function readSpecVersionHead(projectId: string): Promise<SpecVersionHead | null> {
  const [row] = await versionRows(
    'SELECT major, minor, patch FROM spec_version_heads WHERE project_id = ?',
    [projectId],
  );
  if (!row) return null;
  return { major: Number(row.major), minor: Number(row.minor), patch: Number(row.patch) };
}
