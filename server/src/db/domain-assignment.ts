import { getDbState, getLocalSqlite } from './connection.ts';
import { AppError } from '../lib/errors.ts';

// 祖先列は core から parent_id を辿って上向きに集める。 これを述語に使うことで
// 「core が実在する」 と 「business が core の祖先ではない (= 循環しない)」 を
// 同じ書き込みの中で判定でき、 確認と更新の間に割り込まれない。
const ANCESTORS_CTE = `WITH RECURSIVE ancestors(id, parent_id) AS (
    SELECT id, parent_id FROM domains WHERE id = {1} AND project_id = {2} AND definition_kind = 'core'
    UNION
    SELECT d.id, d.parent_id FROM domains d JOIN ancestors a ON d.id = a.parent_id WHERE d.project_id = {3}
  )`;

// SQLite は CTE を UPDATE の前に置けるが、 Postgres の WITH ... UPDATE は
// 本体が CTE を参照できない。 Postgres 側は CTE を副問い合わせに畳んで同じ述語を作る。
const SQLITE_SQL = `${ANCESTORS_CTE} UPDATE domains SET parent_id = {4}, updated_at = {5}
    WHERE id = {6} AND project_id = {7} AND definition_kind = 'business' AND parent_id IS NULL
      AND EXISTS (SELECT 1 FROM ancestors)
      AND NOT EXISTS (SELECT 1 FROM ancestors WHERE id = {8})`;

const PG_SQL = `UPDATE domains SET parent_id = {4}, updated_at = {5}
    WHERE id = {6} AND project_id = {7} AND definition_kind = 'business' AND parent_id IS NULL
      AND EXISTS (${ANCESTORS_CTE} SELECT 1 FROM ancestors)
      AND NOT EXISTS (${ANCESTORS_CTE} SELECT 1 FROM ancestors WHERE id = {8})`;

/** 位置指定の {n} を方言ごとの placeholder へ展開し、 その順で引数を並べ直す。 */
function bind(sql: string, args: unknown[], pg: boolean): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const text = sql.replace(/\{(\d+)\}/g, (_, slot: string) => {
    values.push(args[Number(slot) - 1]);
    return pg ? `$${values.length}` : '?';
  });
  return { text, values };
}

/** Attach only an unassigned business domain; check ancestry in the same write. */
export async function assignBusinessDomain(projectId: string, coreId: string, businessId: string): Promise<void> {
  const sqlite = getLocalSqlite();
  const now = new Date();
  const args = [coreId, projectId, projectId, coreId, sqlite ? now.getTime() : now, businessId, projectId, businessId];
  let changes: number;
  if (sqlite) {
    const { text, values } = bind(SQLITE_SQL, args, false);
    changes = sqlite.transaction(() => sqlite.prepare(text).run(...values).changes)();
  } else {
    const pool = getDbState().pool;
    if (!pool) throw AppError.internal('db_unavailable');
    const { text, values } = bind(PG_SQL, args, true);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // 兄弟の saveDomainDefinition と同じくプロジェクト行を掴んでから書く。
      // 同時に別の core へ配置しようとした要求はここで直列化される。
      await client.query('SELECT id FROM projects WHERE id = $1 FOR UPDATE', [projectId]);
      changes = (await client.query(text, values)).rowCount ?? 0;
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  if (changes !== 1) throw AppError.conflict('business_domain_not_available');
}
