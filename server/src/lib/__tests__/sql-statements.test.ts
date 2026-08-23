// migration の文分割。 見出しコメント付きの文を落とさないことを固定する
// (落とすと 004 の CREATE TABLE が全て無視され、 後続の失敗は skippable に吸われて表に出ない)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitSqlStatements, stripLeadingComments } from '../sql-statements.ts';

test('stripLeadingComments: 先頭のコメント行だけ剥がし、 SQL 本体は残す', () => {
  assert.equal(stripLeadingComments('-- 見出し\nALTER TABLE t ADD COLUMN c text'), 'ALTER TABLE t ADD COLUMN c text');
  assert.equal(stripLeadingComments('\n-- a\n-- b\n\nSELECT 1'), 'SELECT 1');
  assert.equal(stripLeadingComments('-- コメントだけ\n--\n'), '');
  // 文の途中のコメントは触らない
  assert.equal(stripLeadingComments('CREATE TABLE t (\n  -- 説明\n  id text\n)'), 'CREATE TABLE t (\n  -- 説明\n  id text\n)');
});

test('splitSqlStatements: 見出しコメントの直後の文も 1 文として拾う', () => {
  const sql = [
    '-- ヘッダ',
    '-- 続き',
    '',
    '-- (1) 列追加',
    'ALTER TABLE domains ADD COLUMN IF NOT EXISTS anatomia_domain text;',
    'ALTER TABLE projects ADD COLUMN IF NOT EXISTS anatomia_repo text;',
    '',
    '-- (2) 新テーブル',
    'CREATE TABLE IF NOT EXISTS transitions (',
    '  id text PRIMARY KEY,',
    '  trigger text NOT NULL DEFAULT \'tap\'',
    ');',
  ].join('\n');
  const stmts = splitSqlStatements(sql);
  assert.equal(stmts.length, 3);
  assert.ok(stmts[0]!.startsWith('ALTER TABLE domains'));
  assert.ok(stmts[1]!.startsWith('ALTER TABLE projects'));
  assert.ok(stmts[2]!.startsWith('CREATE TABLE IF NOT EXISTS transitions'));
});

test('004: Screen Flow の新テーブルが 1 つも欠けない', () => {
  const path = join(process.cwd(), 'migrations', '004_screen_flow.sql');
  const stmts = splitSqlStatements(readFileSync(path, 'utf-8'));
  for (const table of ['transitions', 'spec_conversations', 'spec_messages', 'cc_links']) {
    assert.ok(
      stmts.some((s) => s.startsWith(`CREATE TABLE IF NOT EXISTS ${table}`)),
      `CREATE TABLE ${table} が実行対象から落ちている`,
    );
  }
  assert.ok(stmts.some((s) => /^ALTER TABLE domains\s+ADD COLUMN IF NOT EXISTS anatomia_domain/.test(s)));
  assert.ok(stmts.some((s) => /^ALTER TABLE spec_targets DROP CONSTRAINT/.test(s)));
  // コメント行が実行対象に混ざっていない
  assert.ok(!stmts.some((s) => s.startsWith('--')));
});
