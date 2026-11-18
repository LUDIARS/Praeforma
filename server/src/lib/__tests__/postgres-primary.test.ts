// Postgres を正本にする切り替えと SQLite からの写し (純関数) — spec/feature/postgres-primary.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalStorage } from '../../db/mode.ts';
import { commonColumns, convertValue, planCopy, quoteIdent, sequenceOf, tableCreationOrder } from '../storage-migration/copy-plan.ts';

test('parseLocalStorage: 未設定は sqlite、postgres は大小無視、知らない値は止める', () => {
  assert.equal(parseLocalStorage(undefined), 'sqlite');
  assert.equal(parseLocalStorage(''), 'sqlite');
  assert.equal(parseLocalStorage('sqlite'), 'sqlite');
  assert.equal(parseLocalStorage(' Postgres '), 'postgres');
  assert.throws(() => parseLocalStorage('mysql'), /PRAEFORMA_LOCAL_STORAGE/);
});

test('tableCreationOrder: migration の順に表名を拾い、重複は最初の 1 回だけ', () => {
  const order = tableCreationOrder([
    'CREATE TABLE IF NOT EXISTS projects (id text);\ncreate table layouts (id text references projects(id));',
    'CREATE TABLE IF NOT EXISTS "spec_fragments" (id text); CREATE TABLE IF NOT EXISTS projects (x int);',
    'CREATE TABLE IF NOT EXISTS public.audit_log (id bigserial);',
  ]);
  assert.deepEqual(order, ['projects', 'layouts', 'spec_fragments', 'audit_log']);
});

test('planCopy: 両方にある表を Postgres の作成順に並べ、SQLite にだけある表を報告する', () => {
  const plan = planCopy(['layouts', 'projects', 'schema_migrations', 'sqlite_sequence', 'legacy_only'], ['projects', 'layouts', 'audit_log']);
  assert.deepEqual(plan.tables, ['projects', 'layouts']);
  assert.deepEqual(plan.sqliteOnly, ['legacy_only']);
});

test('commonColumns: Postgres に無い列は写さず報告する', () => {
  assert.deepEqual(commonColumns(['id', 'name', 'old'], ['id', 'name', 'extra']), { columns: ['id', 'name'], sqliteOnly: ['old'] });
});

test('convertValue: 時刻・真偽・配列・JSON を Postgres の型に合わせる', () => {
  const ms = Date.parse('2026-11-19T00:00:00Z');
  assert.deepEqual(convertValue('timestamp with time zone', 'timestamptz', ms), new Date(ms));
  assert.deepEqual(convertValue('timestamp with time zone', 'timestamptz', String(ms)), new Date(ms));
  assert.equal(convertValue('timestamp with time zone', 'timestamptz', '2026-11-19T00:00:00.000Z'), '2026-11-19T00:00:00.000Z');
  assert.equal(convertValue('boolean', 'bool', 1), true);
  assert.equal(convertValue('boolean', 'bool', 0), false);
  assert.deepEqual(convertValue('ARRAY', '_text', '["web","unity"]'), ['web', 'unity']);
  assert.throws(() => convertValue('ARRAY', '_text', '{"a":1}'));
  assert.equal(convertValue('jsonb', 'jsonb', '{"a":1}'), '{"a":1}');
  assert.equal(convertValue('jsonb', 'jsonb', { a: 1 }), '{"a":1}');
  assert.equal(convertValue('text', 'text', null), null);
  assert.equal(convertValue('bigint', 'int8', 12n), '12');
});

test('sequenceOf / quoteIdent: sequence 名の取り出しと識別子の検査', () => {
  assert.equal(sequenceOf("nextval('audit_log_id_seq'::regclass)"), 'audit_log_id_seq');
  assert.equal(sequenceOf('now()'), null);
  assert.equal(sequenceOf(null), null);
  assert.equal(quoteIdent('spec_targets'), '"spec_targets"');
  assert.throws(() => quoteIdent('x"; DROP TABLE y; --'));
});
