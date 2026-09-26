// ビジュアル素材の書き込み (spec/feature/project-visuals.md PF-VIS-1〜4)。
// 画像の中身は作成後に変えない。削除は、どれかの企画概要書の版が使っていれば「削除済み」の印だけを付けて画像を残し
// (古い版の紙面から画像が消えないように)、使っていなければ行ごと消す。
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from './connection.ts';
import { projects } from './schema/project.ts';
import { projectVisuals } from './schema/project-visual.ts';
import { runDualTransaction, dialectBool, dialectTime } from './dual-dialect.ts';
import { AppError } from '../lib/errors.ts';
import { VISUAL_LIMITS, type VisualKind } from '../../../shared/project-visual.ts';
import type { ConceptSheetImage } from '../../../shared/concept-sheet.ts';

export interface VisualInsert {
  id: string;
  projectId: string;
  kind: VisualKind;
  label: string;
  note: string;
  featured: boolean;
  image: ConceptSheetImage & { byteSize: number };
  createdBy: string;
}
export interface VisualFields { kind: VisualKind; label: string; note: string; featured: boolean }

/** その行を使う版があるか (SQLite / Postgres)。版の visual_refs は [{visualId, …}]。 */
const USED_BY_VERSION_SQLITE = `SELECT 1 FROM concept_sheet_versions v, json_each(v.visual_refs) r
  WHERE v.project_id = project_visuals.project_id AND json_extract(r.value, '$.visualId') = project_visuals.id`;
const USED_BY_VERSION_PG = `SELECT 1 FROM concept_sheet_versions v, jsonb_array_elements(v.visual_refs) r
  WHERE v.project_id = project_visuals.project_id AND r->>'visualId' = project_visuals.id`;

/** 1 プロジェクトの上限 (削除済みの印の行は数えない) を 1 文の中で確かめて足す。 */
export async function insertProjectVisual(v: VisualInsert): Promise<void> {
  const now = new Date();
  const [result] = await runDualTransaction([{
    sqlite: `INSERT INTO project_visuals(id,project_id,kind,label,note,featured,mime_type,byte_size,digest,data_url,revision,created_by,created_at,updated_at)
      SELECT ?,p.id,?,?,?,?,?,?,?,?,1,?,?,? FROM projects p WHERE p.id=? AND p.deleted_at IS NULL
      AND (SELECT count(*) FROM project_visuals WHERE project_id=? AND deleted_at IS NULL) < ?`,
    pg: `INSERT INTO project_visuals(id,project_id,kind,label,note,featured,mime_type,byte_size,digest,data_url,revision,created_by,created_at,updated_at)
      SELECT $1::text,p.id,$2::text,$3::text,$4::text,$5::boolean,$6::text,$7::integer,$8::text,$9::text,1,$10::text,$11::timestamptz,$12::timestamptz
      FROM projects p WHERE p.id=$13 AND p.deleted_at IS NULL
      AND (SELECT count(*) FROM project_visuals WHERE project_id=$14 AND deleted_at IS NULL) < $15`,
    args: (d) => [v.id, v.kind, v.label, v.note, dialectBool(d, v.featured), v.image.mimeType, v.image.byteSize, v.image.digest,
      v.image.dataUrl, v.createdBy, dialectTime(d, now), dialectTime(d, now), v.projectId, v.projectId, VISUAL_LIMITS.perProject],
  }]);
  if (result?.changes === 1) return;
  const [project] = await getDb().select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, v.projectId), isNull(projects.deletedAt))).limit(1);
  if (!project) throw AppError.notFound('project_not_found');
  throw new AppError('visual_limit_reached', 422, { max: VISUAL_LIMITS.perProject });
}

/** 名前・種類・メモ・一押しを版一致で直す。画像の中身は変えない。 */
export async function updateProjectVisual(id: string, projectId: string, fields: VisualFields, expectedRevision: number): Promise<void> {
  const rows = await getDb().update(projectVisuals)
    .set({ ...fields, revision: expectedRevision + 1, updatedAt: new Date() })
    .where(and(eq(projectVisuals.id, id), eq(projectVisuals.projectId, projectId), isNull(projectVisuals.deletedAt),
      eq(projectVisuals.revision, expectedRevision)))
    .returning({ id: projectVisuals.id });
  if (rows.length !== 1) throw await missingOrConflict(projectId, id);
}

/** 版一致で削除する。版が使っていれば削除済みの印を付け (soft)、使っていなければ行を消す (hard)。 */
export async function deleteProjectVisual(id: string, projectId: string, expectedRevision: number): Promise<'soft' | 'hard'> {
  const now = new Date();
  const [soft, hard] = await runDualTransaction([{
    sqlite: `UPDATE project_visuals SET deleted_at=?, updated_at=?, revision=revision+1
      WHERE id=? AND project_id=? AND revision=? AND deleted_at IS NULL AND EXISTS (${USED_BY_VERSION_SQLITE})`,
    pg: `UPDATE project_visuals SET deleted_at=$1, updated_at=$2, revision=revision+1
      WHERE id=$3 AND project_id=$4 AND revision=$5 AND deleted_at IS NULL AND EXISTS (${USED_BY_VERSION_PG})`,
    args: (d) => [dialectTime(d, now), dialectTime(d, now), id, projectId, expectedRevision],
  }, {
    sqlite: `DELETE FROM project_visuals WHERE id=? AND project_id=? AND revision=? AND deleted_at IS NULL
      AND NOT EXISTS (${USED_BY_VERSION_SQLITE})`,
    pg: `DELETE FROM project_visuals WHERE id=$1 AND project_id=$2 AND revision=$3 AND deleted_at IS NULL
      AND NOT EXISTS (${USED_BY_VERSION_PG})`,
    args: () => [id, projectId, expectedRevision],
  }]);
  if (soft?.changes === 1) return 'soft';
  if (hard?.changes === 1) return 'hard';
  throw await missingOrConflict(projectId, id);
}

/** どの版も使わなくなった削除済みの行を消す (企画概要書を消したあとに呼ぶ)。 */
export async function purgeUnreferencedVisuals(projectId: string): Promise<void> {
  await runDualTransaction([{
    sqlite: `DELETE FROM project_visuals WHERE project_id=? AND deleted_at IS NOT NULL AND NOT EXISTS (${USED_BY_VERSION_SQLITE})`,
    pg: `DELETE FROM project_visuals WHERE project_id=$1 AND deleted_at IS NOT NULL AND NOT EXISTS (${USED_BY_VERSION_PG})`,
    args: () => [projectId],
  }]);
}

/** 0 件更新の理由を分ける: 別プロジェクト・存在しない・削除済みなら 404、版が違うなら 409。 */
async function missingOrConflict(projectId: string, id: string): Promise<AppError> {
  const [current] = await getDb().select({ id: projectVisuals.id }).from(projectVisuals)
    .where(and(eq(projectVisuals.id, id), eq(projectVisuals.projectId, projectId), isNull(projectVisuals.deletedAt))).limit(1);
  return current ? AppError.conflict('visual_revision_conflict') : AppError.notFound('visual_not_found');
}
