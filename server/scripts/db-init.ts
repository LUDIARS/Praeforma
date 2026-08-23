/**
 * DB ブートストラップ — Praeforma 用の role / database を冪等に作る。
 *
 * DB 初期化は Praeforma 側で管理する (neco 2026-08-23。 どの Postgres を使うかは
 * 環境ごとの事情なので、 infra の init-databases.sql には依存しない)。
 *
 * 使い方:
 *   PRAEFORMA_DB_ADMIN_URL=postgres://<admin>:<pw>@localhost:5432/postgres \
 *     npm run db:init -w server
 *
 *   - PRAEFORMA_DB_ADMIN_URL … CREATE ROLE / CREATE DATABASE できる管理接続。
 *     未設定なら明示エラー (mock / 既定値へのフォールバックはしない)。
 *   - 作成内容は PRAEFORMA_DATABASE_URL (既定 postgres://praeforma:praeforma@localhost:5432/praeforma)
 *     から導出する: role = user 部、 password = password 部、 database = path 部。
 *   - 既存なら何もしない (冪等)。 role のパスワードは上書きしない。
 *
 * この後 `npm run migrate -w server` で migrations/NNN_*.sql を適用する。
 *
 * @spec feature/praeforma.md §8 PostgreSQL bootstrap
 */

import pg from 'pg';
import { DbInitConfigError, parseDbInitConfig } from '../src/lib/db-init-config.ts';

async function main(): Promise<void> {
  const { adminConnectionString, role, password, database } = parseDbInitConfig(
    process.env.PRAEFORMA_DB_ADMIN_URL,
    process.env.PRAEFORMA_DATABASE_URL,
  );

  const client = new pg.Client({ connectionString: adminConnectionString });
  try {
    await client.connect();

    const roleExists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
    if (roleExists.rowCount === 0) {
      // utility statement は値プレースホルダを受けないため、password は DB 自身に quote させる。
      // role/database は parseDbInitConfig で SQL identifier の文字種に制限済み。
      const quoted = await client.query<{ literal: string }>(
        'SELECT quote_literal($1::text) AS literal',
        [password],
      );
      const passwordLiteral = quoted.rows[0]?.literal;
      if (!passwordLiteral) throw new Error('PostgreSQL did not quote the role password');
      await client.query(`CREATE ROLE ${role} WITH LOGIN PASSWORD ${passwordLiteral}`);
      console.log(`[db-init] role ${role} created`);
    } else {
      console.log(`[db-init] role ${role} exists (password は変更しない)`);
    }

    const dbExists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (dbExists.rowCount === 0) {
      await client.query(`CREATE DATABASE ${database} OWNER ${role}`);
      console.log(`[db-init] database ${database} created (owner ${role})`);
    } else {
      console.log(`[db-init] database ${database} exists`);
    }
    await client.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);

    // public スキーマ権限は対象 DB 側で付与する
    const adminDbUrl = new URL(adminConnectionString);
    adminDbUrl.pathname = `/${database}`;
    const dbClient = new pg.Client({ connectionString: adminDbUrl.toString() });
    try {
      await dbClient.connect();
      await dbClient.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${role}`);
    } finally {
      await dbClient.end();
    }
    console.log('[db-init] done。続けて npm run migrate -w server を実行してください');
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  if (error instanceof DbInitConfigError) {
    console.error(`[db-init] ${error.message}`);
  } else {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code).match(/^[A-Z0-9]{5}$/)?.[0]
        : undefined;
    console.error(
      `[db-init] 初期化に失敗しました${code ? ` (PostgreSQL ${code})` : ''}。接続設定と権限を確認してください。`,
    );
  }
  process.exitCode = 1;
});
