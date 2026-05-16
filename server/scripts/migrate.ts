/**
 * シンプルなマイグレーションランナー。
 *
 * 設計:
 *   - migrations/NNN_*.sql を番号順に読む
 *   - 各 SQL を ; で split し、 1 ステートメントずつ実行
 *   - Cernere 標準: skippable error codes (42P07/42701/42710/42P01/42704/23505) は無視
 *   - schema_migrations テーブルに完了済 NNN を記録 (重複実行防止)
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const SKIPPABLE_CODES = new Set(['42P07', '42701', '42710', '42P01', '42704', '23505']);

async function ensureTrackingTable(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getApplied(client: pg.PoolClient): Promise<Set<string>> {
  const res = await client.query<{ version: string }>(`SELECT version FROM schema_migrations`);
  return new Set(res.rows.map((r) => r.version));
}

async function runStatements(client: pg.PoolClient, sql: string): Promise<void> {
  const stmts = sql
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
  for (const stmt of stmts) {
    try {
      await client.query(stmt);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code && SKIPPABLE_CODES.has(err.code)) {
        console.log(`  [skip ${err.code}] ${stmt.slice(0, 60).replace(/\s+/g, ' ')}…`);
        continue;
      }
      throw e;
    }
  }
}

async function main(): Promise<void> {
  const databaseUrl =
    process.env.PRAEFORMA_DATABASE_URL ??
    'postgres://praeforma:praeforma@localhost:5432/praeforma';
  const migrationsDir = join(process.cwd(), 'migrations');

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const applied = await getApplied(client);

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) {
        console.log(`[migrate] ${file} (already applied)`);
        continue;
      }
      console.log(`[migrate] ${file} applying...`);
      const sql = await readFile(join(migrationsDir, file), 'utf-8');
      await runStatements(client, sql);
      await client.query(`INSERT INTO schema_migrations(version) VALUES ($1)`, [version]);
      console.log(`[migrate] ${file} done`);
    }
    console.log('[migrate] all up-to-date');
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((e) => {
  console.error('[migrate] failed', e);
  process.exit(1);
});
