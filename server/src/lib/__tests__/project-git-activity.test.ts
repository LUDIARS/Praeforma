// トップの一覧を「最近 git 更新があった順」に並べるための、最新コミット時刻の読み取りと並べ方の確認。
// 題材は架空のプロジェクト。実在の非公開プロジェクト名を書かない。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lastUpdateFromReflog, listRepoDirs, ProjectGitActivity, readLastCommitAt, repoDirOf } from '../project-git-activity.ts';
import { sortProjectsByActivity } from '../../../../shared/project-index.ts';

function makeRoot(repos: string[], plain: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), 'pf-git-activity-'));
  for (const name of repos) mkdirSync(join(root, name, '.git'), { recursive: true });
  for (const name of plain) mkdirSync(join(root, name), { recursive: true });
  return root;
}

test('git リポジトリだけを、大文字小文字を問わない名前で引ける', () => {
  const root = makeRoot(['Garden', 'Tower'], ['notes']);
  try {
    const dirs = listRepoDirs(root);
    assert.deepEqual([...dirs.keys()].sort(), ['garden', 'tower']);
    assert.equal(repoDirOf({ id: '1', name: 'garden' }, dirs), join(root, 'Garden'));
    assert.equal(repoDirOf({ id: '2', name: '光の塔', anatomiaRepo: 'tower' }, dirs), join(root, 'Tower'));
    assert.equal(repoDirOf({ id: '3', name: 'notes' }, dirs), null);
    assert.equal(repoDirOf({ id: '4', name: '../Garden' }, dirs), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('置き場所が無ければ全プロジェクトが null になる', () => {
  assert.equal(listRepoDirs(join(tmpdir(), 'pf-git-activity-missing-root')).size, 0);
});

test('最新コミット時刻は TTL の間は読み直さず、同時の問い合わせは 1 回にまとめる', async () => {
  const root = makeRoot(['Garden', 'Tower']);
  let now = 0;
  const reads: string[] = [];
  const activity = new ProjectGitActivity(root, async (dir) => {
    reads.push(dir);
    return dir.endsWith('Garden') ? '2026-09-28T00:00:00.000Z' : null;
  }, 1_000, () => now);
  try {
    const projects = [{ id: 'g', name: 'Garden' }, { id: 't', name: 'Tower' }, { id: 'x', name: 'Nowhere' }];
    const [a, b] = await Promise.all([activity.lookup(projects), activity.lookup(projects)]);
    assert.deepEqual([...a], [['g', '2026-09-28T00:00:00.000Z'], ['t', null], ['x', null]]);
    assert.deepEqual([...b], [...a]);
    assert.equal(reads.length, 2);
    now = 999;
    await activity.lookup(projects);
    assert.equal(reads.length, 2);
    now = 1_000;
    await activity.lookup(projects);
    assert.equal(reads.length, 4);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('最近 git 更新があった順に並べ、リポジトリの無いプロジェクトは Pf 上の更新順で後ろに続ける', () => {
  const sorted = sortProjectsByActivity([
    { id: 'a', updatedAt: '2026-09-29T00:00:00.000Z', gitUpdatedAt: null },
    { id: 'b', updatedAt: '2026-09-01T00:00:00.000Z', gitUpdatedAt: '2026-09-20T00:00:00.000Z' },
    { id: 'c', updatedAt: '2026-09-01T00:00:00.000Z', gitUpdatedAt: '2026-09-28T00:00:00.000Z' },
    { id: 'd', updatedAt: '2026-09-10T00:00:00.000Z', gitUpdatedAt: null },
    { id: 'e', updatedAt: new Date('2026-09-10T00:00:00.000Z'), gitUpdatedAt: null },
  ]);
  assert.deepEqual(sorted.map((p) => p.id), ['c', 'b', 'a', 'e', 'd']);
});

const NL = String.fromCharCode(10);
const ZERO = '0'.repeat(40);
const line = (ts: number, msg: string): string => `${ZERO} ${'1'.repeat(40)} Someone <someone@example.invalid> ${ts} +0900${String.fromCharCode(9)}${msg}`;

test('reflog から、ブランチの切り替えを除いた最後の更新時刻を取る', () => {
  const text = [line(1_790_000_000, 'commit: 庭を足す'), line(1_790_000_100, 'merge origin/main: Fast-forward'),
    line(1_790_000_200, 'checkout: moving from main to feat/x'), ''].join(NL);
  assert.equal(lastUpdateFromReflog(text), new Date(1_790_000_100_000).toISOString());
  assert.equal(lastUpdateFromReflog(line(1_790_000_200, 'checkout: moving from a to b')), null);
  assert.equal(lastUpdateFromReflog('壊れた行'), null);
});

test('git を起動せず reflog を読み、worktree の .git ファイルもたどる', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pf-git-reflog-'));
  try {
    mkdirSync(join(root, 'Garden', '.git', 'logs'), { recursive: true });
    writeFileSync(join(root, 'Garden', '.git', 'logs', 'HEAD'), line(1_790_000_000, 'commit (initial): 庭') + NL);
    mkdirSync(join(root, 'Garden', '.git', 'worktrees', 'wt', 'logs'), { recursive: true });
    writeFileSync(join(root, 'Garden', '.git', 'worktrees', 'wt', 'logs', 'HEAD'), line(1_790_000_500, 'commit: 温室') + NL);
    mkdirSync(join(root, 'Garden-wt'));
    writeFileSync(join(root, 'Garden-wt', '.git'), `gitdir: ${join(root, 'Garden', '.git', 'worktrees', 'wt')}${NL}`);
    mkdirSync(join(root, 'Empty', '.git'), { recursive: true });
    assert.equal(await readLastCommitAt(join(root, 'Garden')), new Date(1_790_000_000_000).toISOString());
    assert.equal(await readLastCommitAt(join(root, 'Garden-wt')), new Date(1_790_000_500_000).toISOString());
    assert.equal(await readLastCommitAt(join(root, 'Empty')), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
