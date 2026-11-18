// 各ブランチの写し (純関数) — spec/feature/branch-snapshot.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExportModel } from '../export/model.ts';
import { buildSnapshotFiles } from '../branch-snapshot/snapshot-files.ts';
import { compareSnapshot } from '../branch-snapshot/compare.ts';
import { isSnapshotPath, parseSnapshotManifest, planSnapshotWrite, SNAPSHOT_MANIFEST } from '../branch-snapshot/snapshot-manifest.ts';
import { parseBranchList } from '../branch-snapshot/snapshot-git.ts';
import { parseArgs } from '../../../scripts/pf-snapshot.ts';

const model: ExportModel = { projectName: 'Demo', anatomiaRepo: null, screens: [], transitions: [], domains: [], ccLinks: [] };
const asMap = (files: Array<{ path: string; content: string }>) => new Map(files.map((f) => [f.path, f.content]));

test('buildSnapshotFiles: manifest と model.json / spec.md / flow.mmd を .praeforma/ に作り、同じ入力は同じ内容', () => {
  const a = buildSnapshotFiles(model, '1.2.0');
  assert.deepEqual(a.map((f) => f.path), ['.praeforma/manifest.json', '.praeforma/model.json', '.praeforma/spec.md', '.praeforma/flow.mmd']);
  assert.deepEqual(buildSnapshotFiles(model, '1.2.0'), a);
  const manifest = parseSnapshotManifest(a[0]!.content)!;
  assert.equal(manifest.specVersion, '1.2.0');
  assert.deepEqual(manifest.files, a.slice(1).map((f) => f.path));
  for (const f of a) assert.ok(f.content.endsWith('\n'));
});

test('compareSnapshot: 写しなし / 壊れた manifest / 一致 / 差分 を見分け、人が置いたファイルは比べない', () => {
  const current = buildSnapshotFiles(model, '1.0.0');
  assert.equal(compareSnapshot(current, new Map()).state, 'none');
  assert.equal(compareSnapshot(current, new Map([[SNAPSHOT_MANIFEST, '{']])).state, 'invalid');
  assert.equal(compareSnapshot(current, asMap(current)).state, 'same');

  const older = buildSnapshotFiles({ ...model, projectName: 'Old' }, '0.9.0');
  const branch = asMap(older);
  branch.delete('.praeforma/flow.mmd');
  branch.set('.praeforma/notes.md', '人のメモ');
  branch.set('.praeforma/legacy.json', '{}');
  const manifest = JSON.parse(branch.get(SNAPSHOT_MANIFEST)!);
  manifest.files.push('.praeforma/legacy.json');
  branch.set(SNAPSHOT_MANIFEST, JSON.stringify(manifest));
  const result = compareSnapshot(current, branch);
  assert.equal(result.state, 'differs');
  assert.equal(result.branchSpecVersion, '0.9.0');
  const status = Object.fromEntries(result.files.map((f) => [f.path, f.status]));
  assert.equal(status['.praeforma/flow.mmd'], 'missing_in_branch');
  assert.equal(status['.praeforma/model.json'], 'changed');
  assert.equal(status['.praeforma/legacy.json'], 'only_in_branch');
  assert.equal(status['.praeforma/notes.md'], undefined);
});

test('planSnapshotWrite: 前回生成して今回生成しないものだけ消し、写しの外は扱わない', () => {
  const current = buildSnapshotFiles(model, '1.0.0');
  const previous = JSON.stringify({ format: 1, project: 'Demo', specVersion: '0.1.0', files: ['.praeforma/model.json', '.praeforma/old.md', '../escape.txt', '.praeforma/../x'] });
  const plan = planSnapshotWrite(current, previous);
  assert.deepEqual(plan.remove, ['.praeforma/old.md']);
  assert.equal(plan.write.length, current.length);
  assert.deepEqual(planSnapshotWrite(current, null).remove, []);
  assert.throws(() => planSnapshotWrite([{ path: 'src/index.ts', content: '' }], null));
});

test('isSnapshotPath: .praeforma/ 配下の素直な相対パスだけ', () => {
  assert.equal(isSnapshotPath('.praeforma/spec.md'), true);
  assert.equal(isSnapshotPath('.praeforma/sub/a.json'), true);
  for (const bad of ['spec.md', '.praeforma/', '.praeforma/../a', '.praeforma/./a', '.praeforma\\a', 'C:/.praeforma/a', '.praeforma//a']) {
    assert.equal(isSnapshotPath(bad), false, bad);
  }
});

test('parseBranchList: for-each-ref の行を読み、コミット id の形が違う行は捨てる', () => {
  const sha = 'a'.repeat(40);
  const items = parseBranchList(`main\t${sha}\t2026-11-19T00:00:00+09:00\nbroken\tzzz\t\n\n`);
  assert.deepEqual(items, [{ name: 'main', commit: sha, updatedAt: '2026-11-19T00:00:00+09:00' }]);
});

test('pf-snapshot parseArgs: project と http(s) の URL が必須で、URL は origin に揃える', () => {
  const options = parseArgs(['--project', 'P1', '--url', 'http://127.0.0.1:8889/', '--dir', '.']);
  assert.equal(options.project, 'P1');
  assert.equal(options.url, 'http://127.0.0.1:8889');
  assert.throws(() => parseArgs(['--project', 'P1']));
  assert.throws(() => parseArgs(['--project', '../x', '--url', 'http://127.0.0.1:1']));
  assert.throws(() => parseArgs(['--project', 'P1', '--url', 'file:///etc/passwd']));
  assert.throws(() => parseArgs(['--project', 'P1', '--url', 'http://h?x=1']));
});
