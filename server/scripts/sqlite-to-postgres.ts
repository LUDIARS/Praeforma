/**
 * 個人用モードの SQLite から Postgres (正本) へ行を写す (spec/feature/postgres-primary.md)。
 *
 *   PRAEFORMA_DATABASE_URL=postgres://… tsx server/scripts/sqlite-to-postgres.ts --sqlite <praeforma.sqlite> [--apply]
 *
 * - 既定は下見 (dry run): 表ごとの行数と写せない表・列を出すだけで、Postgres には書かない。
 * - --apply で 1 つのトランザクションで INSERT … ON CONFLICT DO NOTHING する。既にある行は変えない (何度流しても同じ)。
 * - SQLite にだけある表があれば --apply を拒否する (黙って捨てない)。
 * - SQLite は読み取り専用で開く。Postgres の migration は先に `npm run migrate -w server` で当てておく。
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import Database from 'better-sqlite3';
import { commonColumns, convertValue, planCopy, quoteIdent, sequenceOf, tableCreationOrder } from '../src/lib/storage-migration/copy-plan.ts';

const BATCH = 200;

interface Args { sqlite: string; apply: boolean }

function parseArgs(argv: readonly string[]): Args {
  let sqlite = process.env.PRAEFORMA_LOCAL_DB ?? '';
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--apply') apply = true;
    else if (argv[i] === '--sqlite' && argv[i + 1]) sqlite = argv[++i]!;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!sqlite) throw new Error('--sqlite <path> (or PRAEFORMA_LOCAL_DB) is required');
  return { sqlite, apply };
}

async function migrationOrder(): Promise<string[]> {
  const dir = join(import.meta.dirname, '..', 'migrations');
  const files = (await readdir(dir)).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  return tableCreationOrder(await Promise.all(files.map((f) => readFile(join(dir, f), 'utf8'))));
}

interface PgColumn { column_name: string; data_type: string; udt_name: string; column_default: string | null }

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.PRAEFORMA_DATABASE_URL;
  if (!url) throw new Error('PRAEFORMA_DATABASE_URL is required');
  const sqlite = new Database(args.sqlite, { readonly: true, fileMustExist: true });
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const client = await pool.connect();
  try {
    const tableRows = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const sqliteTables: string[] = tableRows.map((r) => String(r.name));
    const plan = planCopy(sqliteTables, await migrationOrder());
    const report: Array<Record<string, unknown>> = [];
    if (plan.sqliteOnly.length && args.apply) throw new Error(`tables only in SQLite: ${plan.sqliteOnly.join(', ')}`);
    if (args.apply) await client.query('BEGIN');
    for (const table of plan.tables) {
      const pgCols: PgColumn[] = (await client.query(
        "SELECT column_name, data_type, udt_name, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
        [table])).rows as PgColumn[];
      if (pgCols.length === 0) { report.push({ table, error: 'missing_in_postgres (run migrations first)' }); continue; }
      const byName = new Map<string, PgColumn>(pgCols.map((c) => [c.column_name, c]));
      const infoRows = sqlite.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all() as Array<{ name: string }>;
      const sqliteCols: string[] = infoRows.map((c) => String(c.name));
      const { columns, sqliteOnly } = commonColumns(sqliteCols, [...byName.keys()]);
      const rows = sqlite.prepare(`SELECT ${columns.map(quoteIdent).join(',')} FROM ${quoteIdent(table)}`).all() as Array<Record<string, unknown>>;
      let inserted = 0;
      if (args.apply && rows.length) {
        for (let i = 0; i < rows.length; i += BATCH) {
          const chunk = rows.slice(i, i + BATCH);
          const values: unknown[] = [];
          const tuples = chunk.map((row) => `(${columns.map((col) => {
            const meta = byName.get(col)!;
            values.push(convertValue(meta.data_type, meta.udt_name, row[col]));
            return `$${values.length}`;
          }).join(',')})`);
          const result: { rowCount: number | null } = await client.query(
            `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(',')}) VALUES ${tuples.join(',')} ON CONFLICT DO NOTHING`, values);
          inserted += result.rowCount ?? 0;
        }
        for (const col of pgCols) {
          const seq = sequenceOf(col.column_default);
          if (seq) await client.query(`SELECT setval($1, GREATEST((SELECT COALESCE(MAX(${quoteIdent(col.column_name)}), 0) FROM ${quoteIdent(table)}), 1))`, [seq]);
        }
      }
      report.push({ table, sqliteRows: rows.length, ...(args.apply ? { inserted, alreadyPresent: rows.length - inserted } : {}),
        ...(sqliteOnly.length ? { sqliteOnlyColumns: sqliteOnly } : {}) });
    }
    if (args.apply) await client.query('COMMIT');
    process.stdout.write(`${JSON.stringify({ mode: args.apply ? 'apply' : 'dry-run', sqliteOnlyTables: plan.sqliteOnly, tables: report }, null, 2)}\n`);
  } catch (error) {
    if (args.apply) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`sqlite-to-postgres: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
