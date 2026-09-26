// GET /api/projects/:pid/acceptance/summary (spec/feature/acceptance-summary.md PF-ACC-SUM-1)。
// ローカルモード (SQLite) は受入テーブルが無いので run 0 件として返す。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

process.env.PRAEFORMA_LOCAL_MODE = '1';

test('summary is readable locally, needs a token otherwise, and is limited to members', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeAcceptanceSummaryRouter } = await import('../../routes/acceptance.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:'); assert.equal(state.ok, true, state.error ?? undefined);
  const sqlite = getLocalSqlite() as unknown as { close(): void; prepare(sql: string): { run(...args: unknown[]): unknown } };
  try {
    await getDb().insert(projects).values([{ id: 'p', name: 'ひかりの庭', orgId: 'test', ownerUserId: 'local-reviewer' }]);
    await getDb().insert(projectMembers).values([{ id: 'm', projectId: 'p', userId: 'local-reviewer', role: 'owner' }]);
    const app = new Hono();
    app.onError((e) => new Response(JSON.stringify({ error: e.message }), { status: e instanceof AppError ? e.status : 500 }));
    app.route('/api/projects/:pid/acceptance', makeAcceptanceSummaryRouter());

    // 認証を持たない (ローカルモードでない) 状態で token 無しは 401。
    assert.equal((await app.request('/api/projects/p/acceptance/summary')).status, 401);

    // メンバーでない利用者は 403。
    enableLocalAuth({ userId: 'stranger', displayName: null, role: 'user', projectKey: null });
    assert.equal((await app.request('/api/projects/p/acceptance/summary')).status, 403);

    // ローカルモードの固定ユーザは認証なしで読める。
    enableLocalAuth({ userId: 'local-reviewer', displayName: 'Local Reviewer', role: 'owner', projectKey: null });
    const res = await app.request('/api/projects/p/acceptance/summary');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      projectId: 'p',
      runs: { total: 0, byStatus: {} },
      latestRun: null,
      results: { total: 0, passed: 0, failed: 0, blocked: 0, pending: 0 },
      specVersion: '0.0.0',
    });

    sqlite.prepare('INSERT INTO spec_version_heads(project_id, major, minor, patch, revision) VALUES (?, 1, 2, 3, 6)').run('p');
    const versioned = await (await app.request('/api/projects/p/acceptance/summary')).json() as { specVersion: string };
    assert.equal(versioned.specVersion, '1.2.3');
  } finally {
    sqlite.close();
  }
});
