// Runtime logs (log-weaver の weaver.jsonl) は git 管理外。審査・起動のたびに追記されて PR 同士が衝突するため。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..');

test('server/logs/weaver.jsonl is ignored and not tracked by git', () => {
  const ignored = spawnSync('git', ['check-ignore', '-q', 'server/logs/weaver.jsonl'], { cwd: repoRoot });
  assert.equal(ignored.status, 0, 'server/logs/weaver.jsonl must match .gitignore');
  const tracked = spawnSync('git', ['ls-files', '--', 'server/logs'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(tracked.status, 0);
  assert.equal(tracked.stdout.trim(), '', 'nothing under server/logs may be tracked');
});

test('default weaver sink creates a missing logs directory before appending', async () => {
  const { fileJsonlSink } = await import('@ludiars/log-weaver');
  const base = mkdtempSync(join(tmpdir(), 'pf-weaver-'));
  const logsDir = join(base, 'nested', 'logs');
  const previous = process.env.VESTIGIUM_LOGS_DIR;
  process.env.VESTIGIUM_LOGS_DIR = logsDir;
  try {
    assert.equal(existsSync(logsDir), false);
    fileJsonlSink()({ level: 'debug', msg: 'probe' });
    const [line, ...rest] = readFileSync(join(logsDir, 'weaver.jsonl'), 'utf8').trim().split('\n');
    assert.equal(rest.length, 0);
    assert.ok(line);
    assert.equal(JSON.parse(line).msg, 'probe');
  } finally {
    if (previous === undefined) delete process.env.VESTIGIUM_LOGS_DIR;
    else process.env.VESTIGIUM_LOGS_DIR = previous;
    rmSync(base, { recursive: true, force: true });
  }
});
