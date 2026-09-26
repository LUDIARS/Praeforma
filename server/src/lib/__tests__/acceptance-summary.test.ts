// 受入状態の要約の純関数 (spec/feature/acceptance-summary.md PF-ACC-SUM-2)。
// 契約述語 (augur.contracts.json C-1..C-4) を同じ入出力で確かめる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSpecVersion, pickLatestRun, summarizeAcceptance, tallyAcceptanceResults,
  type AcceptanceRunRow,
} from '../acceptance-summary.ts';
import pickLatestRunContract from '../../../contracts/pick-latest-run.contract.ts';
import tallyContract from '../../../contracts/tally-acceptance-results.contract.ts';
import summarizeContract from '../../../contracts/summarize-acceptance.contract.ts';
import formatContract from '../../../contracts/format-spec-version.contract.ts';

const run = (id: string, status: string, startedAt: string, finishedAt: string | null = null): AcceptanceRunRow => ({
  id, status, startedAt: new Date(startedAt), finishedAt: finishedAt ? new Date(finishedAt) : null,
});

test('a project without runs reports no latest run and zero results', () => {
  const input = { projectId: 'p', runs: [], latestResults: [], specVersionHead: null };
  const summary = summarizeAcceptance(input);
  assert.deepEqual(summary, {
    projectId: 'p',
    runs: { total: 0, byStatus: {} },
    latestRun: null,
    results: { total: 0, passed: 0, failed: 0, blocked: 0, pending: 0 },
    specVersion: '0.0.0',
  });
  assert.equal(pickLatestRun([]), null);
  assert.equal(pickLatestRunContract.post(null, []), true);
  assert.equal(summarizeContract.post(summary, input), true);
  assert.equal(formatContract.post(formatSpecVersion(null), null), true);
});

test('the latest run is the newest startedAt, and the larger id on a tie', () => {
  const runs = [
    run('01A', 'passed', '2026-09-01T00:00:00Z', '2026-09-01T00:01:00Z'),
    run('01C', 'failed', '2026-09-03T00:00:00Z'),
    run('01B', 'running', '2026-09-03T00:00:00Z'),
  ];
  const latest = pickLatestRun(runs);
  assert.equal(latest?.id, '01C');
  assert.equal(pickLatestRunContract.post(latest, runs), true);
  assert.notEqual(pickLatestRunContract.post(runs[0]!, runs), true, 'an older run violates C-1');
});

test('results of the latest run are counted per bucket', () => {
  const results = [
    { status: 'pass' }, { status: 'pass' }, { status: 'fail' }, { status: 'error' }, { status: 'skip' },
  ];
  const tally = tallyAcceptanceResults(results);
  assert.deepEqual(tally, { total: 5, passed: 2, failed: 1, blocked: 1, pending: 1 });
  assert.equal(tallyContract.post(tally, results), true);

  const runs = [
    run('01A', 'passed', '2026-09-01T00:00:00Z', '2026-09-01T00:01:00Z'),
    run('01B', 'passed', '2026-09-02T00:00:00Z', '2026-09-02T00:01:00Z'),
    run('01C', 'failed', '2026-09-03T00:00:00Z', '2026-09-03T00:02:00Z'),
  ];
  const input = { projectId: 'p', runs, latestResults: results, specVersionHead: { major: 1, minor: 2, patch: 3 } };
  const summary = summarizeAcceptance(input);
  assert.deepEqual(summary.runs, { total: 3, byStatus: { passed: 2, failed: 1 } });
  assert.deepEqual(summary.latestRun, {
    id: '01C', status: 'failed', startedAt: '2026-09-03T00:00:00.000Z', finishedAt: '2026-09-03T00:02:00.000Z', version: null,
  });
  assert.deepEqual(summary.results, tally);
  assert.equal(summary.specVersion, '1.2.3');
  assert.equal(summarizeContract.post(summary, input), true);
  assert.equal(formatContract.post(formatSpecVersion(input.specVersionHead), input.specVersionHead), true);
});
