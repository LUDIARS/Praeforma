// SQLite (ローカルモード) と Postgres の両方で、いくつかの文を 1 つのトランザクションとして流す。
// SQLite は同期のトランザクションで流す (途中で await しないので、別の要求の文が紛れ込まない)。
// Postgres は 1 本の接続を借りて BEGIN / COMMIT し、確認に落ちたら ROLLBACK する。
import type { PoolClient } from 'pg';
import { getDbState, getLocalSqlite } from './connection.ts';
import { AppError } from '../lib/errors.ts';

export type Dialect = 'sqlite' | 'pg';
export interface DualResult { changes: number; rows: Record<string, unknown>[] }
export interface DualStatement {
  /** SQLite の文 (? の位置引数)。 */
  sqlite: string;
  /** Postgres の文。省略時は sqlite の ? を $1, $2 … に置き換える (型の付け方が同じ文だけ省略する)。 */
  pg?: string;
  args: (dialect: Dialect) => unknown[];
  /** 結果を確かめる。AppError を返したらトランザクションを取り消して投げる。 */
  verify?: (result: DualResult) => AppError | null;
}

/** 時刻は SQLite では ms の整数、Postgres では Date で渡す。 */
export const dialectTime = (dialect: Dialect, date: Date): number | Date => (dialect === 'sqlite' ? date.getTime() : date);
/** 真偽は SQLite では 0 / 1、Postgres では boolean で渡す。 */
export const dialectBool = (dialect: Dialect, value: boolean): number | boolean => (dialect === 'sqlite' ? (value ? 1 : 0) : value);

const toPg = (sql: string): string => { let index = 0; return sql.replace(/\?/g, () => `$${++index}`); };
const returnsRows = (sql: string): boolean => /^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql);

function checked(statement: DualStatement, result: DualResult): DualResult {
  const error = statement.verify?.(result);
  if (error) throw error;
  return result;
}

export async function runDualTransaction(statements: DualStatement[]): Promise<DualResult[]> {
  const sqlite = getLocalSqlite();
  if (sqlite) {
    return sqlite.transaction(() => statements.map((statement) => {
      const prepared = sqlite.prepare(statement.sqlite);
      const args = statement.args('sqlite');
      if (returnsRows(statement.sqlite)) {
        const rows = prepared.all(...args);
        return checked(statement, { changes: rows.length, rows });
      }
      return checked(statement, { changes: prepared.run(...args).changes, rows: [] });
    }))();
  }
  const pool = getDbState().pool;
  if (!pool) throw AppError.internal('db_unavailable');
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const results: DualResult[] = [];
    for (const statement of statements) {
      const result = await client.query(statement.pg ?? toPg(statement.sqlite), statement.args('pg'));
      results.push(checked(statement, { changes: result.rowCount ?? 0, rows: result.rows as Record<string, unknown>[] }));
    }
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
