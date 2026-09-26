// 企画概要書と版の読み取り (spec/feature/concept-sheet.md PF-CS-8 / PF-CS-10)。
import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb } from './connection.ts';
import { conceptSheets, conceptSheetVersions } from './schema/concept-sheet.ts';
import type { ConceptSheetVersionSummary } from '../../../shared/concept-sheet.ts';

export type SheetRow = typeof conceptSheets.$inferSelect;
export type VersionRow = typeof conceptSheetVersions.$inferSelect;

/** 2026-09-26 より前の形 (design を持たない) の行は読まない (spec/schema/concept-sheets.md)。 */
export const isCurrentFormat = (row: { payload: { design?: { html?: unknown } } | null }): boolean =>
  typeof row.payload?.design?.html === 'string';

export async function findSheetRow(projectId: string, id: string): Promise<SheetRow | undefined> {
  const [row] = await getDb().select().from(conceptSheets)
    .where(and(eq(conceptSheets.projectId, projectId), eq(conceptSheets.id, id))).limit(1);
  return row && isCurrentFormat(row) ? row : undefined;
}

/** 一覧 (新しく更新した順)。hasMore を出すため limit + 1 件まで読む。 */
export async function listSheetRows(projectId: string, limit: number, offset: number): Promise<SheetRow[]> {
  return getDb().select().from(conceptSheets).where(eq(conceptSheets.projectId, projectId))
    .orderBy(desc(conceptSheets.updatedAt), conceptSheets.id).limit(limit + 1).offset(offset);
}

/** 自動更新を ON にしているシート。projectId を省くと全プロジェクト (起動時の予約し直しに使う)。古く作った順。 */
export async function listAutoUpdateSheetRows(projectId?: string): Promise<SheetRow[]> {
  const rows = await getDb().select().from(conceptSheets)
    .where(projectId === undefined ? eq(conceptSheets.autoUpdate, true)
      : and(eq(conceptSheets.projectId, projectId), eq(conceptSheets.autoUpdate, true)))
    .orderBy(asc(conceptSheets.updatedAt), asc(conceptSheets.id));
  return rows.filter(isCurrentFormat);
}

export async function findVersionRow(sheetId: string, rv: number): Promise<VersionRow | undefined> {
  const [row] = await getDb().select().from(conceptSheetVersions)
    .where(and(eq(conceptSheetVersions.sheetId, sheetId), eq(conceptSheetVersions.rv, rv))).limit(1);
  return row && isCurrentFormat(row) ? row : undefined;
}

/** 版の一覧 (新しい順)。紙面は読まない。 */
export async function listVersionSummaries(sheetId: string): Promise<ConceptSheetVersionSummary[]> {
  const rows = await getDb().select({ rv: conceptSheetVersions.rv, kind: conceptSheetVersions.kind, createdAt: conceptSheetVersions.createdAt })
    .from(conceptSheetVersions).where(eq(conceptSheetVersions.sheetId, sheetId)).orderBy(desc(conceptSheetVersions.rv));
  return rows.map((r) => ({ rv: r.rv, kind: r.kind, createdAt: r.createdAt.toISOString() }));
}
