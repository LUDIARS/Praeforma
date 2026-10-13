import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  contractsSchema, measurementsSchema, observedLabel, parseSpecTerms, specTermIssues,
  type Contract, type Measurement,
} from '../../../../shared/spec-terms.ts';
import type { ReconstructionPlan } from '../../../../shared/spec-versioning.ts';
process.env.PRAEFORMA_LOCAL_MODE = '1';

const measurement = (over: Partial<Measurement> = {}): Measurement => ({
  id: 'm1', subject: '', metric: '応答時間', unit: 'ms', method: 'API ログの p95', period: 'リリース後 7 日',
  target: '200ms 以下', observed: null, ...over,
});
const contract = (over: Partial<Contract> = {}): Contract => ({
  id: 'c1', subject: 'ログインボーナス', condition: '7 日連続ログイン', judgement: 'サーバのログイン記録',
  reward: { content: 'ジェム', amount: 50, unit: '個' }, grantTiming: '7 日目のログイン時', exceptions: 'BAN 中は付与しない', ...over,
});

test('PF-SPEC-TERMS unmeasured is not zero and observations need a source', () => {
  assert.equal(observedLabel(measurement()), '未計測');
  assert.equal(observedLabel(measurement({ observed: { value: 0, unit: 'ms', observedAt: null, ref: 'run-1' } })), '0 ms');
  assert.equal(measurementsSchema.safeParse([measurement({ observed: { value: 120, unit: 'ms', observedAt: null, ref: '' } })]).success, false);
  assert.equal(measurementsSchema.safeParse([measurement(), measurement()]).success, false, 'ids are unique');
  assert.equal(contractsSchema.safeParse([contract({ reward: { content: '', amount: null, unit: null } })]).success, true,
    'an undefined reward is storable and reported as an issue');
});

test('PF-SPEC-TERMS reports undefined parts and conflicting metrics without merging them', () => {
  assert.deepEqual(specTermIssues({ measurements: [measurement()], contracts: [contract()] }), []);
  const issues = specTermIssues({
    measurements: [
      measurement({ target: '' }),
      measurement({ id: 'm2', unit: 's' }),
      measurement({ id: 'm3', observed: { value: 1.2, unit: 's', observedAt: null, ref: 'run-2' } }),
    ],
    contracts: [contract({ condition: '', judgement: '', reward: { content: '', amount: 10, unit: null }, grantTiming: '' })],
  });
  assert.deepEqual(issues.map((issue) => issue.kind).sort(), [
    'contract_condition_undefined', 'contract_grant_timing_undefined', 'contract_judgement_undefined',
    'contract_reward_undefined', 'contract_reward_unit_missing',
    'measurement_metric_conflict', 'measurement_observed_unit_mismatch', 'measurement_target_undefined',
  ]);
  assert.deepEqual(issues.find((issue) => issue.kind === 'measurement_metric_conflict')?.ids, ['m1', 'm2', 'm3']);
  // 対象が違えば同じ指標名でも衝突にしない。
  assert.deepEqual(specTermIssues({ measurements: [measurement(), measurement({ id: 'm2', subject: '検索', unit: 's' })], contracts: [] }), []);
  assert.throws(() => parseSpecTerms('{"broken"', '[]'), 'a broken stored value is not read as empty');
});

test('PF-SPEC-TERMS specs store terms, report issues, and reconstruction keeps or replaces them', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { domains } = await import('../../db/schema/domain.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeSpecRouter } = await import('../../routes/specs.ts');
  const { makeSpecFragmentRouter } = await import('../../routes/spec-fragments.ts');
  const { makeSpecVersionRouter } = await import('../../routes/spec-versions.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:'); assert.equal(state.ok, true, state.error ?? undefined);
  const sqlite = getLocalSqlite() as unknown as { close(): void };
  try {
    enableLocalAuth({ userId: 'author', displayName: null, role: 'user', projectKey: null });
    await getDb().insert(projects).values({ id: 'p', name: 'One', orgId: 'test', ownerUserId: 'author' });
    await getDb().insert(projectMembers).values({ id: 'a', projectId: 'p', userId: 'author', role: 'owner' });
    await getDb().insert(domains).values({ id: 'd', projectId: 'p', name: 'Rewards' });

    let nextPlan: (specId: string | null) => ReconstructionPlan['changes'][number] = () => { throw new Error('unset'); };
    const app = new Hono();
    app.onError((e) => new Response(JSON.stringify({ error: e.message }), { status: e instanceof AppError ? e.status : 500 }));
    app.route('/projects/:pid/specs', makeSpecRouter());
    app.route('/projects/:pid/spec-fragments', makeSpecFragmentRouter());
    app.route('/projects/:pid/spec-versions', makeSpecVersionRouter('unused', async (_binary, material): Promise<ReconstructionPlan> => ({
      changes: [{ ...nextPlan(material.specs[0]?.id ?? null), fragmentIds: material.fragments.map((f) => f.id) }], deferred: [],
    })));
    const send = (method: string, path: string, body?: unknown) =>
      app.request(path, { method, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });

    // 直接登録: 契約の付与時点が未定義なら、保存したうえで未解決事項として返す。
    const created = await send('POST', '/projects/p/specs', {
      code: 'SPEC-1', title: 'ログインボーナス', targets: [{ kind: 'domain', ref_id: 'd' }],
      measurements: [measurement()], contracts: [contract({ grantTiming: '' })],
    });
    assert.equal(created.status, 201);
    const sid = (await created.json() as { spec: { id: string } }).spec.id;
    let detail = await (await send('GET', `/projects/p/specs/${sid}`)).json() as {
      spec: { version: number; measurements: Measurement[]; contracts: Contract[] }; term_issues: Array<{ kind: string }>;
    };
    assert.equal(firstObserved(detail), null, 'unmeasured stays null');
    assert.deepEqual(detail.term_issues.map((issue) => issue.kind), ['contract_grant_timing_undefined']);
    // 関数経由で読む (assert の型の絞り込みを再取得後まで持ち越さない)。
    function firstObserved(value: typeof detail) { return value.spec.measurements[0]?.observed ?? null; }
    assert.equal((await send('POST', '/projects/p/specs', {
      code: 'SPEC-2', title: 'x', targets: [{ kind: 'domain', ref_id: 'd' }], measurements: [{ id: 'm1' }],
    })).status, 400, 'a measurement without metric and unit is rejected');

    // 楽観ロック付きで更新できる。古い版は 409。
    const patched = await send('PATCH', `/projects/p/specs/${sid}`, { prev_version: detail.spec.version, contracts: [contract()] });
    assert.equal(patched.status, 200);
    assert.equal((await send('PATCH', `/projects/p/specs/${sid}`, { prev_version: detail.spec.version, contracts: [] })).status, 409);

    // 再構築: 計測・契約を省略した変更は既存のまま残す。
    const reconstruct = async (eventId: string, content: string) => {
      assert.equal((await send('POST', '/projects/p/spec-fragments', { content, sourceEventId: eventId })).status, 201);
      const draft = await (await send('POST', '/projects/p/spec-versions/reconstructions')).json() as { proposal: { id: string } };
      assert.equal((await send('POST', `/projects/p/spec-versions/reconstructions/${draft.proposal.id}/confirm`)).status, 200);
    };
    nextPlan = (specId) => ({ specId, domainId: 'd', title: 'ログインボーナス', description: '説明を足した', fragmentIds: [], rationale: '説明の追記' });
    await reconstruct('00000000-0000-4000-8000-000000000001', '説明を足す');
    detail = await (await send('GET', `/projects/p/specs/${sid}`)).json() as typeof detail;
    assert.equal(detail.spec.contracts[0]!.grantTiming, '7 日目のログイン時');
    assert.equal(detail.spec.measurements.length, 1);

    // 再構築で計測を差し替えると、確定した版に原文の数値が載る。
    nextPlan = (specId) => ({
      specId, domainId: 'd', title: 'ログインボーナス', description: '説明を足した', fragmentIds: [], rationale: '計測の更新',
      measurements: [measurement({ target: '150ms 以下', observed: { value: 180, unit: 'ms', observedAt: '2026-10-13', ref: 'load-test-7' } })],
    });
    await reconstruct('00000000-0000-4000-8000-000000000002', 'p95 を 150ms 以下に。負荷試験では 180ms だった');
    detail = await (await send('GET', `/projects/p/specs/${sid}`)).json() as typeof detail;
    assert.equal(detail.spec.measurements[0]!.target, '150ms 以下');
    assert.equal(firstObserved(detail)?.value, 180);
    const history = await (await send('GET', '/projects/p/spec-versions')).json() as { logs: Array<{ payload: { changes?: Array<{ after: { measurements?: Measurement[] } }> } }> };
    assert.equal(history.logs[0]!.payload.changes?.[0]?.after.measurements?.[0]?.target, '150ms 以下', 'the version log keeps the terms');
  } finally { sqlite.close(); }
});
