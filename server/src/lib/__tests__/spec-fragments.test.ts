import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { SpecFragment } from '../../../../shared/spec-fragments.ts';

process.env.PRAEFORMA_LOCAL_MODE = '1';

test('fragment ingestion preserves original input, deduplicates events and scopes versioned updates', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeSpecFragmentRouter } = await import('../../routes/spec-fragments.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:');
  assert.equal(state.ok, true, state.error ?? undefined);
  const sqlite = getLocalSqlite() as unknown as { close(): void };
  try {
    const identify = (userId: string): void => enableLocalAuth({ userId, displayName: null, role: 'user', projectKey: null });
    identify('author');
    await getDb().insert(projects).values([
      { id: 'p1', name: 'First', orgId: 'test', ownerUserId: 'author' },
      { id: 'p2', name: 'Second', orgId: 'test', ownerUserId: 'author' },
    ]);
    await getDb().insert(projectMembers).values([
      { id: 'm1', projectId: 'p1', userId: 'author', role: 'owner' },
      { id: 'm2', projectId: 'p2', userId: 'author', role: 'owner' },
      { id: 'm3', projectId: 'p1', userId: 'reader', role: 'viewer' },
      { id: 'm4', projectId: 'p1', userId: 'other', role: 'planner' },
    ]);
    const app = new Hono();
    app.onError((error) => new Response(JSON.stringify({ error: error.message }), {
      status: error instanceof AppError ? error.status : 500, headers: { 'content-type': 'application/json' },
    }));
    app.route('/projects/:pid/fragments', makeSpecFragmentRouter());
    const request = async (path: string, method: string, body: unknown): Promise<Response> => app.request(path, {
      method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const input = { content: '  応答時間 200 ms以下\n条件: 成功率99%以上 / 報酬: 10ポイント  ', sourceEventId: randomUUID() };
    const response = await request('/projects/p1/fragments', 'POST', input);
    assert.equal(response.status, 201);
    const { fragment } = await response.json() as { fragment: SpecFragment };
    assert.equal(fragment.content, input.content);
    assert.equal(fragment.source, 'pf');
    assert.equal(fragment.implementationState, 'unimplemented');
    const retry = await request('/projects/p1/fragments', 'POST', input);
    assert.equal(retry.status, 200);
    assert.equal((await retry.json() as { fragment: SpecFragment }).fragment.id, fragment.id);
    assert.equal((await request('/projects/p1/fragments', 'POST', { ...input, content: 'changed' })).status, 409);
    assert.equal((await request('/projects/p1/fragments', 'POST', { ...input, sourceEventId: randomUUID() })).status, 201);
    assert.equal((await request('/projects/p1/fragments', 'POST', { ...input, source: 'cc' })).status, 400);
    assert.equal((await request('/projects/p1/fragments', 'POST', { ...input, content: ' \n ' })).status, 400);
    identify('other');
    assert.equal((await request('/projects/p1/fragments', 'POST', input)).status, 409);
    identify('author');
    const update = { expectedRevision: 1, implementationState: 'implemented', implementationEvidence: 'commit abc / test result' };
    assert.equal((await request(`/projects/p2/fragments/${fragment.id}/implementation`, 'PATCH', update)).status, 404);
    assert.equal((await request(`/projects/p1/fragments/${fragment.id}/implementation`, 'PATCH', { ...update, implementationEvidence: '' })).status, 400);
    const saved = await request(`/projects/p1/fragments/${fragment.id}/implementation`, 'PATCH', update);
    assert.equal(saved.status, 200);
    const updated = (await saved.json() as { fragment: SpecFragment }).fragment;
    assert.equal(updated.revision, 2);
    assert.equal(updated.content, input.content);
    assert.equal(updated.implementationUpdatedBy, 'author');
    assert.equal((await request(`/projects/p1/fragments/${fragment.id}/implementation`, 'PATCH', update)).status, 409);
    const page = await app.request('/projects/p1/fragments?limit=1&offset=0');
    const listed = await page.json() as { items: SpecFragment[]; hasMore: boolean };
    assert.equal(listed.items.length, 1);
    assert.equal(listed.hasMore, true);
    identify('reader');
    assert.equal((await app.request('/projects/p1/fragments')).status, 200);
    assert.equal((await request('/projects/p1/fragments', 'POST', input)).status, 403);
    assert.equal((await request(`/projects/p1/fragments/${fragment.id}/implementation`, 'PATCH', update)).status, 403);
    identify('author');
    await getDb().update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, 'p1'));
    assert.equal((await app.request('/projects/p1/fragments')).status, 404);
    assert.equal((await request('/projects/p1/fragments', 'POST', input)).status, 404);
  } finally { sqlite.close(); }
});
