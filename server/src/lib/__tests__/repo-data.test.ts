import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { DATA_BRANCH, DATA_MANIFEST_PATH, publishToDataBranch, readDataBranchFile, readDataBranchHead } from '../repo-data/data-branch-git.ts';
import { parseBranchFragments } from '../repo-data/import-fragments.ts';
import { stableJson, stableRowsJson } from '../repo-data/stable-json.ts';

test('branch fragments must be well formed', () => {
  const fragment = { content: '本文', source: 'pf', sourceEventId: '11111111-1111-4111-8111-111111111111' };
  assert.deepEqual(parseBranchFragments(JSON.stringify([fragment])), [fragment]);
  assert.throws(() => parseBranchFragments('{"not":"a list"}'));
  assert.throws(() => parseBranchFragments('not json'));
});

let repo: string;
const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
const manifest = (...files: string[]) => ({ path: DATA_MANIFEST_PATH, content: JSON.stringify({ files }) });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'pf-data-test-'));
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  git('-c', 'user.name=t', '-c', 'user.email=t@t.invalid', 'commit', '--allow-empty', '-q', '-m', 'init');
  writeFileSync(join(repo, 'code.txt'), 'working tree');
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

test('stable JSON ignores key order and removes people', () => {
  assert.equal(stableJson({ b: 1, a: 2, createdBy: 'x', ownerUserId: 'y' }), stableJson({ a: 2, b: 1 }));
});

test('rows are ordered independently of the query', () => {
  assert.equal(stableRowsJson([{ id: 2 }, { id: 1 }]), stableRowsJson([{ id: 1 }, { id: 2 }]));
});

test('publishing creates the branch and leaves the checkout alone', async () => {
  const result = await publishToDataBranch(repo, [{ path: 'fragments/a.json', content: '[]\n' }, manifest('fragments/a.json')], 'first');
  assert.equal(result.changed, true);
  assert.equal(git('show', `${DATA_BRANCH}:fragments/a.json`), '[]');
  assert.equal(git('branch', '--show-current'), 'main');
  assert.equal(readFileSync(join(repo, 'code.txt'), 'utf8'), 'working tree');
  assert.equal(await readDataBranchHead(repo), result.commit);
});

test('reading from the branch returns null for a missing branch or file', async () => {
  assert.equal(await readDataBranchFile(repo, 'a.json'), null);
  await publishToDataBranch(repo, [{ path: 'a.json', content: '[1]\n' }, manifest('a.json')], 'first');
  assert.equal(await readDataBranchFile(repo, 'a.json'), '[1]');
  assert.equal(await readDataBranchFile(repo, 'missing.json'), null);
});

test('publishing identical data makes no commit', async () => {
  const files = [{ path: 'a.json', content: '1\n' }, manifest('a.json')];
  const first = await publishToDataBranch(repo, files, 'first');
  const second = await publishToDataBranch(repo, files, 'second');
  assert.equal(second.changed, false);
  assert.equal(second.commit, first.commit);
});

test('files no longer generated are removed while hand-added files stay', async () => {
  // A file on the branch that the manifest does not list counts as added by hand.
  await publishToDataBranch(repo, [{ path: 'old.json', content: '1\n' }, { path: 'notes.md', content: 'by hand\n' }, manifest('old.json')], 'first');

  await publishToDataBranch(repo, [{ path: 'new.json', content: '2\n' }, manifest('new.json')], 'second');
  const names = git('ls-tree', '-r', '--name-only', DATA_BRANCH).split('\n');
  assert.deepEqual(names.sort(), [DATA_MANIFEST_PATH, 'new.json', 'notes.md'].sort());
});
