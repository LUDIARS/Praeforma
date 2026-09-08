// ドメイン定義の版一致保存 (spec/feature/domain-definition-links.md PF-DL-INV3/INV4)。
// 露出先の有効性は UPDATE の述語にも入れ、 route の事前確認との競合でも
// 別プロジェクト / 削除済 layout が保存されないようにする。

import { getDbState, getLocalSqlite } from './connection.ts';
import type { DomainDefinitionInput } from '../lib/domain-definition.ts';
import { AppError } from '../lib/errors.ts';

/** Persist revision-checked definitions on both supported databases. */
async function projectWrite(projectId: string, sqliteSql: string, pgSql: string,
  sqliteParams: unknown[], pgParams: unknown[]): Promise<number> {
  const sqlite = getLocalSqlite();
  if (sqlite) return sqlite.transaction(() => sqlite.prepare(sqliteSql).run(...sqliteParams).changes)();
  const pool = getDbState().pool;
  if (!pool) throw AppError.internal('db_unavailable');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM projects WHERE id = $1 FOR UPDATE', [projectId]);
    const result = await client.query(pgSql, pgParams);
    await client.query('COMMIT');
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function saveDomainDefinition(projectId: string, domainId: string, input: DomainDefinitionInput): Promise<void> {
  const now = new Date();
  const refs = JSON.stringify(input.sceneIds);
  const common = [input.kind, input.value, refs, input.anatomiaDomain, input.expectedRevision + 1];
  const tail = [domainId, projectId, input.expectedRevision, refs];
  const changes = await projectWrite(projectId,
    `UPDATE domains SET definition_kind=?, definition_value=?, definition_scene_ids=?, anatomia_domain=?,
      definition_revision=?, updated_at=? WHERE id=? AND project_id=? AND definition_revision=?
      AND NOT EXISTS (SELECT 1 FROM json_each(?) s LEFT JOIN layouts l
        ON l.id=s.value AND l.project_id=domains.project_id AND l.deleted_at IS NULL WHERE l.id IS NULL)`,
    `UPDATE domains SET definition_kind=$1, definition_value=$2, definition_scene_ids=$3::jsonb, anatomia_domain=$4,
      definition_revision=$5, updated_at=$6 WHERE id=$7 AND project_id=$8 AND definition_revision=$9
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text($10::jsonb) AS s(id) LEFT JOIN layouts l
        ON l.id=s.id AND l.project_id=domains.project_id AND l.deleted_at IS NULL WHERE l.id IS NULL)`,
    [...common, now.getTime(), ...tail], [...common, now, ...tail]);
  if (changes !== 1) throw AppError.conflict('domain_definition_changed_or_scene_unavailable');
}
