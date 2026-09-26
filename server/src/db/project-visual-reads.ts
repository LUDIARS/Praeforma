// ビジュアル素材の読み取り (spec/feature/project-visuals.md)。一覧は画像の中身を読まない (1 枚 4MB まで × 30 枚まで)。
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from './connection.ts';
import { projectVisuals } from './schema/project-visual.ts';
import type { ProjectVisual, ProjectVisualWithImage } from '../../../shared/project-visual.ts';

const META = {
  id: projectVisuals.id, kind: projectVisuals.kind, label: projectVisuals.label, note: projectVisuals.note,
  featured: projectVisuals.featured, mimeType: projectVisuals.mimeType, byteSize: projectVisuals.byteSize,
  digest: projectVisuals.digest, revision: projectVisuals.revision, createdAt: projectVisuals.createdAt,
  updatedAt: projectVisuals.updatedAt, deletedAt: projectVisuals.deletedAt,
};
type MetaRow = { [K in keyof typeof META]: (typeof projectVisuals.$inferSelect)[K] };
export type VisualRow = typeof projectVisuals.$inferSelect;

export function toProjectVisual(row: MetaRow): ProjectVisual {
  return {
    id: row.id, kind: row.kind, label: row.label, note: row.note, featured: row.featured, mimeType: row.mimeType,
    byteSize: row.byteSize, digest: row.digest, revision: row.revision,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}
export const toProjectVisualWithImage = (row: VisualRow): ProjectVisualWithImage => ({ ...toProjectVisual(row), dataUrl: row.dataUrl });

/** 削除していないビジュアル (登録した順)。画像の中身は含めない。 */
export async function listProjectVisuals(projectId: string): Promise<ProjectVisual[]> {
  const rows = await getDb().select(META).from(projectVisuals)
    .where(and(eq(projectVisuals.projectId, projectId), isNull(projectVisuals.deletedAt)))
    .orderBy(asc(projectVisuals.createdAt), asc(projectVisuals.id));
  return rows.map(toProjectVisual);
}

/** 1 枚を画像ごと。削除済みの印の行は、版の紙面を出すときだけ読む (includeDeleted)。 */
export async function findProjectVisual(projectId: string, id: string, includeDeleted = false): Promise<VisualRow | undefined> {
  const [row] = await getDb().select().from(projectVisuals)
    .where(and(eq(projectVisuals.projectId, projectId), eq(projectVisuals.id, id),
      includeDeleted ? undefined : isNull(projectVisuals.deletedAt)))
    .limit(1);
  return row;
}

/** 複数を画像ごと。並びは保証しない (呼ぶ側が id で引く)。 */
export async function findProjectVisuals(projectId: string, ids: string[], includeDeleted = false): Promise<VisualRow[]> {
  if (ids.length === 0) return [];
  return getDb().select().from(projectVisuals)
    .where(and(eq(projectVisuals.projectId, projectId), inArray(projectVisuals.id, [...new Set(ids)]),
      includeDeleted ? undefined : isNull(projectVisuals.deletedAt)));
}

/** 名前・種類・メモと削除の有無だけ (鮮度の判定に使う。画像の中身は読まない)。 */
export async function findVisualMeta(projectId: string, ids: string[]): Promise<MetaRow[]> {
  if (ids.length === 0) return [];
  return getDb().select(META).from(projectVisuals)
    .where(and(eq(projectVisuals.projectId, projectId), inArray(projectVisuals.id, [...new Set(ids)])));
}

/** 同じ画像 (digest) の、削除していない行。前の形の候補をビジュアルへ移すときに二重に登録しない。 */
export async function findVisualByDigest(projectId: string, digest: string): Promise<VisualRow | undefined> {
  const [row] = await getDb().select().from(projectVisuals)
    .where(and(eq(projectVisuals.projectId, projectId), eq(projectVisuals.digest, digest), isNull(projectVisuals.deletedAt)))
    .orderBy(asc(projectVisuals.createdAt)).limit(1);
  return row;
}
