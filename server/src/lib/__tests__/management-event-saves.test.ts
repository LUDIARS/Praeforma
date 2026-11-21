import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Hono } from 'hono';
import type { ManagementEvent } from '../management-event-payload.ts';

process.env.PRAEFORMA_LOCAL_MODE = '1';

test('successful design writes enqueue after commit and retries preserve the payload', { timeout: 20_000 }, async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { layouts } = await import('../../db/schema/layout.ts');
  const { domains } = await import('../../db/schema/domain.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeSpecRouter } = await import('../../routes/specs.ts');
  const { makeDomainRouter } = await import('../../routes/domains.ts');
  const { makeSceneEditorRouter } = await import('../../routes/scene-editor.ts');
  const { canvasFromRuntime } = await import('../../../../shared/scene-editor.ts');
  const { startManagementEvents } = await import('../management-events.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:');
  assert.equal(state.ok, true, state.error ?? undefined);
  const sqlite = getLocalSqlite()!;
  const requests: ManagementEvent[] = [];
  const stop = startManagementEvents({ CONCORDIA_URL: 'http://127.0.0.1:11111' }, async (_url, init) => {
    const event = JSON.parse(String(init?.body)) as ManagementEvent;
    requests.push(event);
    if (requests.length === 1) throw new TypeError('offline');
    return new Response(null, { status: event.kind === 'domain-created' ? 403 : 200 });
  });
  try {
    enableLocalAuth({ userId: 'private-user', displayName: 'Private Actor', role: 'user', projectKey: null });
    await getDb().insert(projects).values({ id: 'KD', name: 'Private Project', orgId: 'test', ownerUserId: 'private-user' });
    await getDb().insert(projectMembers).values({ id: 'm', projectId: 'KD', userId: 'private-user', role: 'owner' });
    await getDb().insert(layouts).values({ id: 'scene', projectId: 'KD', name: 'Private Scene', kind: 'ui-2d' });
    await getDb().insert(domains).values({ id: 'seed-domain', projectId: 'KD', name: 'Seed domain' });

    const app = new Hono();
    app.onError(error => new Response(error.message, { status: error instanceof AppError ? error.status : 500 }));
    app.route('/projects/:pid/specs', makeSpecRouter());
    app.route('/projects/:pid/domains', makeDomainRouter());
    app.route('/projects/:pid/layouts/:lid/scene-editor', makeSceneEditorRouter('unused'));
    const save = (path: string, method: string, body: unknown) => app.request(`/projects/KD/${path}`, {
      method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });

    const spec = await save('specs', 'POST', {
      code: 'R1', title: 'Private Requirement', targets: [{ kind: 'domain', ref_id: 'seed-domain' }],
    });
    assert.equal(spec.status, 201, await spec.text());
    assert.equal(sqlite.prepare('SELECT id FROM specs WHERE project_id=?').all('KD').length, 1);
    for (let attempts = 0; !requests.length && attempts < 200; attempts++) await delay(10);
    assert.equal(requests.length, 1);
    const domain = await save('domains', 'POST', { name: 'Private Domain' });
    assert.equal(domain.status, 201, await domain.text());
    const { revision, ...canvas } = canvasFromRuntime({
      version: 1, source: 'scene', capturedAt: '2026-11-21T17:00:00Z',
      viewport: { width: 1280, height: 720 }, nodes: [],
    }, 'frame');
    const scene = { canvas: { ...canvas, expected_revision: revision }, sources: [] };
    const sceneResponse = await save('layouts/scene/scene-editor', 'PUT', scene);
    assert.equal(sceneResponse.status, 200, await sceneResponse.text());
    assert.equal((await save('layouts/scene/scene-editor', 'PUT', scene)).status, 409);
    assert.equal(sqlite.prepare('SELECT revision FROM scene_documents WHERE layout_id=?').all('scene')[0]?.revision, 1);

    for (let attempts = 0; requests.length < 4 && attempts < 350; attempts++) await delay(20);
    assert.deepEqual(requests.map(event => event.kind), ['spec-created', 'domain-created', 'scene-updated', 'spec-created']);
    assert.deepEqual(requests[3], requests[0]);
    assert.equal(requests[2]?.target_key, 'scene/scene');
    assert.ok(requests.every(event => event.project_code === 'KD' && event.origin === 'human'));
    assert.doesNotMatch(JSON.stringify(requests), /private/i);
  } finally {
    stop();
    (sqlite as unknown as { close(): void }).close();
  }
});
