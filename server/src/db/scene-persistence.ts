import { getDbState, getLocalSqlite } from './connection.ts';
import type { SceneDocument } from '../../../shared/scene-editor.ts';
import { AppError } from '../lib/errors.ts';

/** Compare-and-swap with project/scene liveness in the same statement. PF-SCENE-5/6. */
export async function persistScene(layoutId: string, projectId: string, document: SceneDocument, expected: number): Promise<void> {
  const now = new Date(); const json = JSON.stringify(document); const sqlite = getLocalSqlite();
  let changes: number;
  if (sqlite) {
    const live = 'SELECT l.id FROM layouts l JOIN projects p ON p.id=l.project_id WHERE l.id=? AND l.project_id=? AND l.deleted_at IS NULL AND p.deleted_at IS NULL';
    changes = expected === 0
      ? sqlite.prepare(`INSERT INTO scene_documents(layout_id,project_id,payload,revision,updated_at) SELECT id,?,?,1,? FROM (${live}) WHERE 1 ON CONFLICT(layout_id) DO NOTHING`).run(projectId,json,now.getTime(),layoutId,projectId).changes
      : sqlite.prepare(`UPDATE scene_documents SET payload=?,revision=revision+1,updated_at=? WHERE layout_id=? AND project_id=? AND revision=? AND EXISTS(${live})`).run(json,now.getTime(),layoutId,projectId,expected,layoutId,projectId).changes;
  } else {
    const pool = getDbState().pool; if (!pool) throw AppError.internal('db_unavailable');
    const live = 'SELECT l.id FROM layouts l JOIN projects p ON p.id=l.project_id WHERE l.id=$1 AND l.project_id=$2 AND l.deleted_at IS NULL AND p.deleted_at IS NULL';
    const result = expected === 0
      ? await pool.query(`INSERT INTO scene_documents(layout_id,project_id,payload,revision,updated_at) SELECT id,$2,$3::jsonb,1,$4 FROM (${live}) live ON CONFLICT(layout_id) DO NOTHING`,[layoutId,projectId,json,now])
      : await pool.query(`UPDATE scene_documents SET payload=$3::jsonb,revision=revision+1,updated_at=$4 WHERE layout_id=$1 AND project_id=$2 AND revision=$5 AND EXISTS(${live})`,[layoutId,projectId,json,now,expected]);
    changes = result.rowCount ?? 0;
  }
  if (changes !== 1) throw AppError.conflict('scene_revision_conflict');
}
