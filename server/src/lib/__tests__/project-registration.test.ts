import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

// node --test のファイル単位プロセス内で、schemaのimportより前にSQLiteを選択する。
process.env.PRAEFORMA_LOCAL_MODE = '1';

interface DomainResponse { domain: { id: string; definitionKind: string; definitionValue: string; parentId: string | null } }
async function json<T>(response: Response): Promise<T> { return await response.json() as T; }

test('登録API: 分類・親子・アクター説明を保持し、仕様の所属ドメインを検証する', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeDomainRouter } = await import('../../routes/domains.ts');
  const { makeObjectRouter } = await import('../../routes/objects.ts');
  const { makeSpecRouter } = await import('../../routes/specs.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:');
  assert.equal(state.ok, true, state.error ?? undefined);
  const sqlite = getLocalSqlite() as unknown as { close(): void };
  try {
    enableLocalAuth({ userId: 'registration-test', displayName: null, role: 'user', projectKey: null });
    await getDb().insert(projects).values([
      { id: 'p1', name: 'Test', orgId: 'test', ownerUserId: 'registration-test' },
      { id: 'p2', name: 'Other', orgId: 'test', ownerUserId: 'registration-test' },
    ]);
    await getDb().insert(projectMembers).values([
      { id: 'm1', projectId: 'p1', userId: 'registration-test', role: 'owner' },
      { id: 'm2', projectId: 'p2', userId: 'registration-test', role: 'owner' },
    ]);
    const app = new Hono();
    app.onError((error) => new Response(JSON.stringify({ error: error.message }), {
      status: error instanceof AppError ? error.status : 500, headers: { 'content-type': 'application/json' },
    }));
    app.route('/projects/:pid/domains', makeDomainRouter());
    app.route('/projects/:pid/objects', makeObjectRouter());
    app.route('/projects/:pid/specs', makeSpecRouter());
    const post = async (path: string, body: unknown): Promise<Response> => app.request(path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const parentResponse = await post('/projects/p1/domains', { name: 'Core', description: '説明', definition: { kind: 'core', value: '価値' } });
    assert.equal(parentResponse.status, 201);
    const { domain: parent } = await json<DomainResponse>(parentResponse);
    assert.equal(parent.definitionKind, 'core');
    assert.equal(parent.definitionValue, '価値');
    const childResponse = await post('/projects/p1/domains', { name: 'Child', parent_id: parent.id, definition: { kind: 'business', value: '支援' } });
    assert.equal(childResponse.status, 201);
    assert.equal((await json<DomainResponse>(childResponse)).domain.parentId, parent.id);
    const foreignResponse = await post('/projects/p2/domains', { name: 'Foreign' });
    const foreignId = (await json<DomainResponse>(foreignResponse)).domain.id;
    assert.equal((await post('/projects/p1/domains', { name: 'Invalid child', parent_id: foreignId })).status, 400);
    const actorResponse = await post('/projects/p1/objects', { label: 'Actor', description: '操作する人', domain_id: parent.id });
    assert.equal(actorResponse.status, 201);
    const actorId = (await json<{ object: { id: string } }>(actorResponse)).object.id;
    const listedActors = await json<{ items: Array<{ description: string; domainId: string }> }>(await app.request('/projects/p1/objects'));
    assert.equal(listedActors.items[0]?.description, '操作する人');
    assert.equal(listedActors.items[0]?.domainId, parent.id);
    assert.equal((await post('/projects/p1/objects', { label: 'Foreign actor', domain_id: foreignId })).status, 400);
    const spec = { code: 'SPEC-1', title: '登録仕様' };
    assert.equal((await post('/projects/p1/specs', spec)).status, 400);
    assert.equal((await post('/projects/p1/specs', { ...spec, targets: [{ kind: 'project', ref_id: 'p1' }] })).status, 400);
    assert.equal((await post('/projects/p1/specs', { ...spec, targets: [{ kind: 'domain', ref_id: foreignId }] })).status, 400);
    const specResponse = await post('/projects/p1/specs', { ...spec, targets: [{ kind: 'domain', ref_id: parent.id }] });
    assert.equal(specResponse.status, 201);
    const { spec: savedSpec } = await json<{ spec: { id: string } }>(specResponse);
    const detail = await json<{ targets: Array<{ refId: string }> }>(await app.request(`/projects/p1/specs/${savedSpec.id}`));
    assert.equal(detail.targets[0]?.refId, parent.id);
    assert.equal((await json<{ items: unknown[] }>(await app.request('/projects/p1/specs'))).items.length, 1);

    // 他 project 経由では spec を読めない / 書き換えられない (role は :pid にしか効かないため)。
    assert.equal((await app.request(`/projects/p2/specs/${savedSpec.id}`)).status, 404);
    assert.equal((await app.request(`/projects/p2/specs/${savedSpec.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prev_version: 1, title: '乗っ取り' }),
    })).status, 404);
    assert.equal((await app.request(`/projects/p2/specs/${savedSpec.id}/targets`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targets: [] }),
    })).status, 404);
    // p1 経由なら読めたまま (scope 追加で正規経路を壊していない)。
    assert.equal((await app.request(`/projects/p1/specs/${savedSpec.id}`)).status, 200);

    // アクターも同様に、 他 project 経由では参照できない。
    assert.equal((await app.request(`/projects/p2/objects/${actorId}`)).status, 404);
    assert.equal((await app.request(`/projects/p1/objects/${actorId}`)).status, 200);
  } finally { sqlite.close(); }
});
