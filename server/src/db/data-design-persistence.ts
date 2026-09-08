/** Atomic first-save / revision-checked replacement on the supported databases. PF-DATA-2. */
import type { DataDesign, DataDesignSnapshot } from '../../../shared/data-design.ts';
import { getDbState, getLocalSqlite } from './connection.ts';
import { AppError } from '../lib/errors.ts';

export async function persistDataDesign(projectId: string, actorId: string, definition: DataDesign,
  expectedRevision: number): Promise<DataDesignSnapshot | null> {
  const now = new Date();
  const json = JSON.stringify(definition);
  const revision = expectedRevision + 1;
  const sqlite = getLocalSqlite();
  let changes: number;
  if (sqlite) {
    changes = sqlite.transaction(() => expectedRevision === 0
      ? sqlite.prepare(`INSERT INTO data_designs (project_id, definition, revision, updated_by, created_at, updated_at)
          SELECT id, ?, 1, ?, ?, ? FROM projects WHERE id = ? AND deleted_at IS NULL
          ON CONFLICT(project_id) DO NOTHING`).run(json, actorId, now.getTime(), now.getTime(), projectId).changes
      : sqlite.prepare(`UPDATE data_designs SET definition = ?, revision = ?, updated_by = ?, updated_at = ?
          WHERE project_id = ? AND revision = ?
          AND EXISTS (SELECT 1 FROM projects WHERE id = data_designs.project_id AND deleted_at IS NULL)`)
        .run(json, revision, actorId, now.getTime(), projectId, expectedRevision).changes)();
  } else {
    const pool = getDbState().pool;
    if (!pool) throw AppError.internal('db_unavailable');
    const result = expectedRevision === 0
      ? await pool.query(`INSERT INTO data_designs (project_id, definition, revision, updated_by, created_at, updated_at)
          SELECT id, $2::jsonb, 1, $3, $4, $4 FROM projects WHERE id = $1 AND deleted_at IS NULL
          ON CONFLICT(project_id) DO NOTHING`, [projectId, json, actorId, now])
      : await pool.query(`UPDATE data_designs SET definition = $2::jsonb, revision = $3, updated_by = $4, updated_at = $5
          WHERE project_id = $1 AND revision = $6
          AND EXISTS (SELECT 1 FROM projects WHERE id = data_designs.project_id AND deleted_at IS NULL)`,
        [projectId, json, revision, actorId, now, expectedRevision]);
    changes = result.rowCount ?? 0;
  }
  return changes === 1 ? { definition, revision, updatedAt: now.toISOString() } : null;
}
