import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DbInitConfigError, parseDbInitConfig } from '../db-init-config.ts';

const ADMIN_URL = 'postgres://admin:secret@localhost:5432/postgres';

test('db-init config: app URL から role/password/database を復号する', () => {
  assert.deepEqual(
    parseDbInitConfig(ADMIN_URL, 'postgresql://praeforma:p%40ss%27word@localhost:5432/praeforma'),
    {
      adminConnectionString: ADMIN_URL,
      role: 'praeforma',
      password: "p@ss'word",
      database: 'praeforma',
    },
  );
});

test('db-init config: app URL 未指定時はローカル既定値を使う', () => {
  const config = parseDbInitConfig(ADMIN_URL, undefined);
  assert.equal(config.role, 'praeforma');
  assert.equal(config.password, 'praeforma');
  assert.equal(config.database, 'praeforma');
});

test('db-init config: 管理 URL 必須、scheme と identifier を制限する', () => {
  assert.throws(() => parseDbInitConfig(undefined, undefined), DbInitConfigError);
  assert.throws(
    () => parseDbInitConfig('https://admin.invalid/postgres', undefined),
    /scheme は postgres\/postgresql/,
  );
  assert.throws(
    () => parseDbInitConfig(ADMIN_URL, 'postgres://bad-role:pw@localhost:5432/praeforma'),
    /role\/database 名/,
  );
  assert.throws(
    () => parseDbInitConfig(ADMIN_URL, 'postgres://praeforma:pw@localhost:5432/db%2Fname'),
    /role\/database 名/,
  );
  assert.throws(
    () => parseDbInitConfig(ADMIN_URL, 'postgres://praeforma:%00@localhost:5432/praeforma'),
    /password は空または NUL/,
  );
});

test('db-init config: エラーへ接続 URL や password を含めない', () => {
  const password = 'do-not-log-this';
  assert.throws(
    () => parseDbInitConfig(ADMIN_URL, `not a url containing ${password}`),
    (error: unknown) =>
      error instanceof DbInitConfigError &&
      !error.message.includes(password) &&
      !error.message.includes('not a url'),
  );
});
