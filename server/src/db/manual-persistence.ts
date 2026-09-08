import { getDbState, getLocalSqlite } from './connection.ts';
import type { ManualPayload } from './schema/feature-manual.ts';
import { AppError } from '../lib/errors.ts';

/** Atomic insert or compare-and-swap, including project liveness. PF-MANUAL-8. */
export async function persistManual(id: string, projectId: string, payload: ManualPayload, expectedRevision: number): Promise<void> {
  const now = new Date(); const json = JSON.stringify(payload); const sqlite = getLocalSqlite();
  let changes: number;
  if (sqlite) {
    changes = expectedRevision === 0
      ? sqlite.prepare('INSERT INTO feature_manuals(id,project_id,payload,revision,updated_at) SELECT ?,id,?,1,? FROM projects WHERE id=? AND deleted_at IS NULL ON CONFLICT(id) DO NOTHING').run(id,json,now.getTime(),projectId).changes
      : sqlite.prepare('UPDATE feature_manuals SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND project_id=? AND revision=? AND EXISTS(SELECT 1 FROM projects WHERE id=? AND deleted_at IS NULL)').run(json,now.getTime(),id,projectId,expectedRevision,projectId).changes;
  } else {
    const pool = getDbState().pool;
    if (!pool) throw AppError.internal('db_unavailable');
    const result = expectedRevision === 0
      ? await pool.query('INSERT INTO feature_manuals(id,project_id,payload,revision,updated_at) SELECT $1,id,$3::jsonb,1,$4 FROM projects WHERE id=$2 AND deleted_at IS NULL ON CONFLICT(id) DO NOTHING',[id,projectId,json,now])
      : await pool.query('UPDATE feature_manuals SET payload=$3::jsonb,revision=revision+1,updated_at=$4 WHERE id=$1 AND project_id=$2 AND revision=$5 AND EXISTS(SELECT 1 FROM projects WHERE id=$2 AND deleted_at IS NULL)',[id,projectId,json,now,expectedRevision]);
    changes = result.rowCount ?? 0;
  }
  if (changes !== 1) throw AppError.conflict('manual_revision_conflict');
}
