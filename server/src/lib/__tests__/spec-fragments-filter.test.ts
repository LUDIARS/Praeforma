// 断片の処理結果による絞り込みと件数 — spec/feature/spec-review-home.md PF-HOME-12
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { SpecFragment } from '../../../../shared/spec-fragments.ts';

process.env.PRAEFORMA_LOCAL_MODE = '1';

test('断片一覧は保留中 / 採用 / 却下で絞り込め、ページ送りは絞り込み後にかかる', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeSpecFragmentRouter } = await import('../../routes/spec-fragments.ts');
  const { versionBatch } = await import('../../db/spec-version-store.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:');
  assert.equal(state.ok, true, state.error ?? undefined);
  const sqlite = getLocalSqlite() as unknown as { close(): void };
  try {
    enableLocalAuth({ userId: 'author', displayName: null, role: 'user', projectKey: null });
    await getDb().insert(projects).values([{ id: 'p1', name: 'First', orgId: 'test', ownerUserId: 'author' }]);
    await getDb().insert(projectMembers).values([{ id: 'm1', projectId: 'p1', userId: 'author', role: 'owner' }]);
    const app = new Hono();
    app.onError((error) => new Response(JSON.stringify({ error: error.message }), {
      status: error instanceof AppError ? error.status : 500, headers: { 'content-type': 'application/json' },
    }));
    app.route('/projects/:pid/fragments', makeSpecFragmentRouter());
    const ids: string[] = [];
    for (const content of ['一', '二', '三', '四', '五']) {
      const response = await app.request('/projects/p1/fragments', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content, sourceEventId: randomUUID() }),
      });
      ids.push(((await response.json()) as { fragment: SpecFragment }).fragment.id);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await versionBatch([
      { sql: "INSERT INTO spec_reconstructions(id,project_id,payload,confirmed_version) VALUES('r1','p1','{}','1.0.0')", args: [] },
      {
        sql: "INSERT INTO spec_reconstruction_fragments(fragment_id,reconstruction_id,disposition) VALUES(?,'r1','integrated'),(?,'r1','rejected')",
        args: [ids[0]!, ids[1]!],
      },
    ]);
    const list = async (query: string) => {
      const response = await app.request(`/projects/p1/fragments?${query}`);
      return { status: response.status, body: await response.json() as { items: SpecFragment[]; hasMore: boolean } };
    };
    const pending = await list('disposition=pending&limit=2&offset=0');
    assert.equal(pending.status, 200);
    assert.deepEqual(pending.body.items.map((f) => f.content), ['五', '四']);
    assert.equal(pending.body.hasMore, true);
    assert.deepEqual((await list('disposition=pending&limit=2&offset=2')).body.items.map((f) => f.content), ['三']);
    const integrated = await list('disposition=integrated');
    assert.deepEqual(integrated.body.items.map((f) => [f.content, f.disposition?.state]), [['一', 'integrated']]);
    assert.deepEqual((await list('disposition=rejected')).body.items.map((f) => f.content), ['二']);
    assert.equal((await list('')).body.items.length, 5);
    assert.equal((await list('disposition=all')).status, 400);
    const counts = await app.request('/projects/p1/fragments/counts');
    assert.deepEqual(await counts.json(), { pending: 3, integrated: 1, rejected: 1 });
  } finally { sqlite.close(); }
});
