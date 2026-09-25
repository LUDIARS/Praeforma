import { getDbState, getLocalSqlite } from './connection.ts';
import type { ConceptSheetPayload } from './schema/concept-sheet.ts';
import { AppError } from '../lib/errors.ts';

/** 版一致で作成 (expectedRevision=0) または更新する。削除済みプロジェクトには書かない。PF-CS-6。 */
export async function persistConceptSheet(id: string, projectId: string, payload: ConceptSheetPayload, expectedRevision: number): Promise<void> {
  const now = new Date(); const json = JSON.stringify(payload); const sqlite = getLocalSqlite();
  let changes: number;
  if (sqlite) {
    changes = expectedRevision === 0
      ? sqlite.prepare('INSERT INTO concept_sheets(id,project_id,payload,revision,updated_at) SELECT ?,id,?,1,? FROM projects WHERE id=? AND deleted_at IS NULL ON CONFLICT(id) DO NOTHING').run(id, json, now.getTime(), projectId).changes
      : sqlite.prepare('UPDATE concept_sheets SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND project_id=? AND revision=? AND EXISTS(SELECT 1 FROM projects WHERE id=? AND deleted_at IS NULL)').run(json, now.getTime(), id, projectId, expectedRevision, projectId).changes;
  } else {
    const pool = getDbState().pool;
    if (!pool) throw AppError.internal('db_unavailable');
    const result = expectedRevision === 0
      ? await pool.query('INSERT INTO concept_sheets(id,project_id,payload,revision,updated_at) SELECT $1,id,$3::jsonb,1,$4 FROM projects WHERE id=$2 AND deleted_at IS NULL ON CONFLICT(id) DO NOTHING', [id, projectId, json, now])
      : await pool.query('UPDATE concept_sheets SET payload=$3::jsonb,revision=revision+1,updated_at=$4 WHERE id=$1 AND project_id=$2 AND revision=$5 AND EXISTS(SELECT 1 FROM projects WHERE id=$2 AND deleted_at IS NULL)', [id, projectId, json, now, expectedRevision]);
    changes = result.rowCount ?? 0;
  }
  if (changes !== 1) throw AppError.conflict('concept_sheet_revision_conflict');
}

/** 版一致で削除する。別の人の更新を消さない。 */
export async function deleteConceptSheet(id: string, projectId: string, expectedRevision: number): Promise<void> {
  const sqlite = getLocalSqlite();
  let changes: number;
  if (sqlite) {
    changes = sqlite.prepare('DELETE FROM concept_sheets WHERE id=? AND project_id=? AND revision=?').run(id, projectId, expectedRevision).changes;
  } else {
    const pool = getDbState().pool;
    if (!pool) throw AppError.internal('db_unavailable');
    changes = (await pool.query('DELETE FROM concept_sheets WHERE id=$1 AND project_id=$2 AND revision=$3', [id, projectId, expectedRevision])).rowCount ?? 0;
  }
  if (changes !== 1) throw AppError.conflict('concept_sheet_revision_conflict');
}
