// 事前コンパイル起動 (server/dist/local.js) でもソース基準のパスが変わらないこと。
// 契約述語 (augur.contracts.json C-8) を同じ入出力で確かめる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, SERVER_DIR, repoPath, serverDirOf } from '../runtime-paths.ts';
import serverDirContract from '../../../contracts/server-dir.contract.ts';
import { ENTRY, OUT_FILE, serverBuildOptions } from '../../../scripts/build-server.mjs';

const server = resolve('/repo/server');
const url = (path: string) => pathToFileURL(path).href;

test('serverDirOf: bundle 後の dist/local.js から server/ を返す', () => {
  const moduleUrl = url(join(server, 'dist', 'local.js'));
  const dir = serverDirOf(moduleUrl);
  assert.equal(dir, server);
  assert.equal(serverDirContract.post!(dir, moduleUrl), true);
});

test('serverDirOf: ソースの src/lib/runtime-paths.ts から server/ を返す', () => {
  const moduleUrl = url(join(server, 'src', 'lib', 'runtime-paths.ts'));
  const dir = serverDirOf(moduleUrl);
  assert.equal(dir, server);
  assert.equal(serverDirContract.post!(dir, moduleUrl), true);
});

test('serverDirOf: dist 以外の .js はソース扱い (2 つ上)', () => {
  const moduleUrl = url(join(server, 'src', 'lib', 'runtime-paths.js'));
  assert.equal(serverDirOf(moduleUrl), server);
});

test('REPO_ROOT / SERVER_DIR は実リポジトリの位置を指す', () => {
  assert.equal(SERVER_DIR, resolve(REPO_ROOT, 'server'));
  assert.ok(existsSync(join(SERVER_DIR, 'package.json')));
  assert.ok(existsSync(repoPath('skills', 'concept-sheet', 'SKILL.md')));
  assert.ok(existsSync(repoPath('skills', 'feature-manual', 'SKILL.md')));
});

test('build 設定: local.ts を dist/ 直下の 1 本へ bundle し、npm 依存は bundle しない', () => {
  const options = serverBuildOptions(server);
  assert.deepEqual(options.entryPoints, [join(server, ENTRY)]);
  assert.equal(options.outfile, join(server, OUT_FILE));
  assert.equal(relative(join(server, 'dist'), options.outfile), 'local.js');
  assert.equal(options.bundle, true);
  assert.equal(options.splitting, false);
  assert.equal(options.packages, 'external');
  assert.equal(options.format, 'esm');
  assert.equal(options.platform, 'node');
});

// bundle すると import.meta.url は dist/local.js を指すので、モジュール位置からの相対パスは
// ソースと食い違う。runtime-paths.ts (と複数階層を探す service-version.ts) 以外で使わせない。
test('import.meta.url の相対パス解決は runtime-paths.ts 経由に限る', () => {
  const allowed = new Set(['lib/runtime-paths.ts', 'service-version.ts']);
  const srcDir = join(SERVER_DIR, 'src');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(path); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      const rel = relative(srcDir, path).replaceAll('\\', '/');
      if (allowed.has(rel)) continue;
      if (readFileSync(path, 'utf8').includes('import.meta.url')) offenders.push(rel);
    }
  };
  walk(srcDir);
  assert.deepEqual(offenders, []);
});
