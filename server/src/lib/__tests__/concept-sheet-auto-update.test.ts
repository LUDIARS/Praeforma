// 企画概要書の自動更新の予約 (spec/feature/concept-sheet.md PF-CS-11) の確認。
// タイマーは差し替えて、10 分待たずに「静かな時間が過ぎた」ことにする。題材は架空の企画「ひかりの庭」。
import { openTestApp, settle } from './concept-sheet-fixtures.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const NOW = new Date('2026-09-26T00:00:00Z');

function fakeTimers() {
  const pending = new Map<number, { fn: () => void; ms: number }>();
  let next = 0;
  return {
    pending,
    timers: {
      set: (fn: () => void, ms: number): unknown => { next += 1; pending.set(next, { fn, ms }); return next; },
      clear: (handle: unknown): void => { pending.delete(handle as number); },
    },
    /** 静かな時間が過ぎたことにして、いま予約されているものを走らせる。 */
    elapse: (): void => { const due = [...pending.values()]; pending.clear(); for (const t of due) t.fn(); },
  };
}

async function makeUpdater(options: {
  targets: () => string[]; regenerate: (projectId: string, sheetId: string) => Promise<void>; outdatedProjects?: string[];
}) {
  const { ConceptSheetJobs } = await import('../concept-sheet-jobs.ts');
  const { ConceptSheetAutoUpdater } = await import('../concept-sheet-auto-update.ts');
  const fake = fakeTimers();
  const jobs = new ConceptSheetJobs(() => NOW);
  const warnings: string[] = [];
  const updater = new ConceptSheetAutoUpdater({
    jobs, timers: fake.timers, now: () => NOW, warn: (m) => warnings.push(m),
    findTargets: async () => options.targets(), findOutdatedProjects: async () => options.outdatedProjects ?? [],
    regenerate: options.regenerate,
  });
  return { updater, jobs, fake, warnings };
}

test('changes are debounced for 10 minutes, then outdated sheets are regenerated one at a time', async () => {
  let targets = ['s1', 's2'];
  const regenerated: string[] = [];
  const { updater, jobs, fake } = await makeUpdater({ targets: () => targets, regenerate: async (pid, sid) => {
    regenerated.push(`${pid}:${sid}`); targets = targets.filter((t) => t !== sid);
  } });
  updater.notifyChange('p');
  updater.notifyChange('p');
  assert.equal(fake.pending.size, 1, '変更が続く間は、1 つの予約を最後の変更から数え直す');
  assert.equal([...fake.pending.values()][0]?.ms, 10 * 60_000);
  assert.equal(updater.scheduledAt('p'), '2026-09-26T00:10:00.000Z');
  assert.equal(updater.scheduledAt('other'), null);
  assert.deepEqual(regenerated, [], '静かな時間が過ぎるまでは走らない');

  fake.elapse(); await settle();
  assert.deepEqual(regenerated, ['p:s1', 'p:s2']);
  assert.equal(updater.scheduledAt('p'), null);
  assert.equal(jobs.get('p'), null, '成功したものは状態に残さない');
});

test('auto updates share the generation slot with people and are shown as running', async () => {
  let release: () => void = () => {};
  const regenerated: string[] = [];
  const { updater, jobs, fake } = await makeUpdater({ targets: () => (regenerated.length ? [] : ['s1']), regenerate: async (_pid, sid) => {
    regenerated.push(sid); await new Promise<void>((resolve) => { release = resolve; });
  } });
  // 人が作り直している間は走らせず、静かな時間をもう一度待つ。
  let finishManual: () => void = () => {};
  const manual = jobs.start('p', 's1', () => new Promise<void>((resolve) => { finishManual = resolve; }), 'manual');
  updater.notifyChange('p');
  fake.elapse(); await settle();
  assert.deepEqual(regenerated, []);
  assert.equal(fake.pending.size, 1, '枠が空くのを待って予約し直す');
  finishManual(); await manual;

  fake.elapse(); await settle();
  assert.deepEqual(regenerated, ['s1']);
  assert.deepEqual(jobs.get('p'), { sheetId: 's1', trigger: 'auto', state: 'running', startedAt: NOW.toISOString() });
  assert.throws(() => jobs.start('p', 's1', async () => {}, 'manual'), (e: unknown) => (e as { status?: number }).status === 429,
    '自動更新の間は人の作り直しを受け付けない');
  release(); await settle();
  assert.equal(jobs.get('p'), null);
});

test('a failed auto update keeps its reason and is retried only after the next change', async () => {
  const { AppError } = await import('../errors.ts');
  const calls: string[] = [];
  const { updater, jobs, fake } = await makeUpdater({ targets: () => ['s1'], outdatedProjects: ['p'], regenerate: async (_pid, sid) => {
    calls.push(sid); throw new AppError('astra_failed', 502);
  } });
  updater.notifyChange('p');
  fake.elapse(); await settle();
  assert.deepEqual(calls, ['s1'], '失敗したシートは続けて作り直さない');
  assert.deepEqual(jobs.get('p'), { sheetId: 's1', trigger: 'auto', state: 'failed', startedAt: NOW.toISOString(),
    finishedAt: NOW.toISOString(), error: 'astra_failed' });

  // 変更の無い予約し直し (起動時など) では作り直さない。
  await updater.rescheduleOutdated();
  assert.equal(updater.scheduledAt('p'), '2026-09-26T00:10:00.000Z');
  fake.elapse(); await settle();
  assert.deepEqual(calls, ['s1']);

  updater.notifyChange('p');
  fake.elapse(); await settle();
  assert.deepEqual(calls, ['s1', 's1'], '次の変更でもう一度試す');
});

test('stopping the updater clears the timers and ignores later changes', async () => {
  const { updater, fake, warnings } = await makeUpdater({ targets: () => { throw new Error('lookup failed'); }, regenerate: async () => {} });
  updater.notifyChange('p');
  updater.notifyChange('q');
  fake.elapse(); await settle();
  assert.equal(warnings.length, 2, '対象を探せなければ記録して止まる (予約の失敗で落ちない)');
  updater.notifyChange('p');
  updater.stop();
  assert.equal(fake.pending.size, 0);
  assert.equal(updater.scheduledAt('p'), null);
  updater.notifyChange('p');
  assert.equal(fake.pending.size, 0, '止めた後は予約しない');
});

test('saving UX, constraints, specs and visuals notifies the auto update, reading and failed saves do not', async () => {
  const { makeProjectConstraintRouter } = await import('../../routes/project-constraints.ts');
  const { makeProjectUxGoalRouter } = await import('../../routes/project-ux-goal.ts');
  const changes: string[] = [];
  const notify = (pid: string): void => { changes.push(pid); };
  const t = await openTestApp((app) => {
    app.route('/projects/:pid/constraints', makeProjectConstraintRouter(notify));
    app.route('/projects/:pid/ux-goal', makeProjectUxGoalRouter(notify));
  });
  try {
    const ux = { experience: '光を集める', design: '集めた光で花が咲く', goal: '庭が育つ' };
    assert.equal((await t.request('/projects/p/ux-goal', 'PUT', { ...ux, expectedRevision: 0 })).status, 200);
    assert.equal((await t.request('/projects/p/ux-goal', 'PUT', { ...ux, expectedRevision: 0 })).status, 409);
    assert.equal((await t.request('/projects/p/ux-goal', 'GET')).status, 200);
    assert.deepEqual(changes, ['p']);

    const res = await t.request('/projects/p/constraints', 'POST', { kind: 'planning', title: '1 回は 5 分で遊べる', detail: '' });
    assert.equal(res.status, 201);
    const constraint = (await res.json() as { constraint: { id: string } }).constraint;
    assert.equal((await t.request(`/projects/p/constraints/${constraint.id}`, 'PUT',
      { kind: 'planning', title: '1 回は 3 分で遊べる', detail: '', expectedRevision: 1 })).status, 200);
    assert.equal((await t.request(`/projects/p/constraints/${constraint.id}`, 'PUT',
      { kind: 'planning', title: '古い版', detail: '', expectedRevision: 1 })).status, 409);
    assert.equal((await t.request(`/projects/p/constraints/${constraint.id}?expectedRevision=2`, 'DELETE')).status, 200);
    assert.equal((await t.request('/projects/other/constraints', 'GET')).status, 200);
    assert.deepEqual(changes, ['p', 'p', 'p', 'p'], '作成・更新・削除を知らせる (失敗と読み取りは知らせない)');
  } finally { t.close(); }
});
