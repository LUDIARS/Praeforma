// Drizzle + pg pool。 起動失敗を許容する設計 (= DB が落ちていても healthz は返す)。

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.ts';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;
let connectError: string | null = null;

export interface DbState {
  ok: boolean;
  pool: pg.Pool | null;
  db: NodePgDatabase<typeof schema> | null;
  error: string | null;
}

/**
 * ローカル「仕様書レビュー」モード: 埋め込み SQLite (better-sqlite3) を開き、 Studio 最小
 * サブセットの DDL を流して drizzle を構成する。 Postgres も Cernere も不要。
 * 返す drizzle は型上は NodePgDatabase に寄せる (クエリ API は方言間で構造的に互換)。
 */
export async function initLocalDb(dbPath: string): Promise<DbState> {
  try {
    const { mkdirSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    mkdirSync(dirname(dbPath), { recursive: true });
    const Database = (await import('better-sqlite3')).default;
    const { drizzle: drizzleSqlite } = await import('drizzle-orm/better-sqlite3');
    const { sqliteTables, SQLITE_DDL } = await import('./sqlite-schema.ts');
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    for (const ddl of SQLITE_DDL) sqlite.exec(ddl);
    db = drizzleSqlite(sqlite, { schema: sqliteTables }) as unknown as NodePgDatabase<typeof schema>;
    connectError = null;
    console.log(`[db] local sqlite ready: ${dbPath}`);
    return { ok: true, pool: null, db, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    connectError = msg;
    console.error(`[db] local sqlite init failed: ${msg}`);
    return { ok: false, pool: null, db: null, error: msg };
  }
}

/** 起動時 1 回呼ぶ。 接続失敗時は throw せず error を state に残す。 */
export async function initDb(databaseUrl: string): Promise<DbState> {
  try {
    pool = new Pool({ connectionString: databaseUrl, max: 20 });
    // smoke ping
    await pool.query('SELECT 1');
    db = drizzle(pool, { schema });
    connectError = null;
    console.log('[db] connected');
    return { ok: true, pool, db, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    connectError = msg;
    console.warn(`[db] connection failed: ${msg} — healthz は db:"down" を返す`);
    return { ok: false, pool: null, db: null, error: msg };
  }
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) throw new Error('db not initialized (or connection failed)');
  return db;
}

export function getDbState(): DbState {
  return { ok: db !== null, pool, db, error: connectError };
}
