// 遷移図キャンバスの位置保存とキャプチャ — spec/feature/scene-map.md PF-MAP-7 / PF-MAP-10
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import type { SceneMap } from '../../../../shared/project-home.ts';

process.env.PRAEFORMA_LOCAL_MODE = '1';

test('位置は owner / planner だけが保存でき、知らないシーンが混ざれば何も保存しない', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { layouts } = await import('../../db/schema/layout.ts');
  const { sceneDocuments } = await import('../../db/schema/scene-editor.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeSceneMapRouter } = await import('../../routes/scene-map.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:');
  assert.equal(state.ok, true, state.error ?? undefined);
  const sqlite = getLocalSqlite() as unknown as { close(): void };
  try {
    const identify = (userId: string): void => enableLocalAuth({ userId, displayName: null, role: 'user', projectKey: null });
    await getDb().insert(projects).values([
      { id: 'p1', name: 'First', orgId: 'test', ownerUserId: 'author' },
      { id: 'p2', name: 'Second', orgId: 'test', ownerUserId: 'author' },
    ]);
    await getDb().insert(projectMembers).values([
      { id: 'm1', projectId: 'p1', userId: 'author', role: 'owner' },
      { id: 'm2', projectId: 'p1', userId: 'reader', role: 'viewer' },
    ]);
    await getDb().insert(layouts).values([
      { id: 'L1', projectId: 'p1', name: 'タイトル', kind: 'ui-2d', isDefault: true },
      { id: 'L2', projectId: 'p1', name: 'ショップ', kind: 'ui-2d' },
      { id: 'X1', projectId: 'p2', name: '他のシーン', kind: 'ui-2d' },
    ]);
    const png = Buffer.from('capture-bytes').toString('base64');
    const frame = { id: 'f1', name: 'f1', description: '', states: [], x: 0, y: 0, width: 10, height: 10, viewport: { width: 10, height: 10 } };
    await getDb().insert(sceneDocuments).values({
      layoutId: 'L2', projectId: 'p1', revision: 1, updatedAt: new Date(),
      payload: { canvas: { revision: 1, frames: [frame], elements: [], transitions: [] },
        sources: [{ id: 's1', frameId: 'f1', fingerprint: null, image: `data:image/png;base64,${png}`, runtime: null, notes: [] }] },
    } as never);
    const app = new Hono();
    app.onError((error) => new Response(JSON.stringify({ error: error.message }), {
      status: error instanceof AppError ? error.status : 500, headers: { 'content-type': 'application/json' },
    }));
    app.route('/projects/:pid/scene-map', makeSceneMapRouter());
    const put = (body: unknown) => app.request('/projects/p1/scene-map/positions', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const read = async (): Promise<SceneMap> => (await app.request('/projects/p1/scene-map')).json() as Promise<SceneMap>;

    identify('author');
    const first = await read();
    assert.equal(first.canEdit, true);
    assert.deepEqual(first.scenes.map((s) => [s.id, s.position, s.hasCapture]), [['L1', null, false], ['L2', null, true]]);
    assert.equal((await put({ positions: [{ layoutId: 'L1', x: 10, y: 20 }, { layoutId: 'X1', x: 0, y: 0 }] })).status, 400);
    assert.deepEqual((await read()).scenes.map((s) => s.position), [null, null]);
    assert.equal((await put({ positions: [{ layoutId: 'L1', x: 10, y: 20 }, { layoutId: 'L2', x: 400.5, y: -30 }] })).status, 200);
    assert.equal((await put({ positions: [{ layoutId: 'L1', x: 15, y: 25 }] })).status, 200);
    assert.deepEqual((await read()).scenes.map((s) => s.position), [{ x: 15, y: 25 }, { x: 400.5, y: -30 }]);

    const capture = await app.request('/projects/p1/scene-map/scenes/L2/capture');
    assert.equal(capture.status, 200);
    assert.equal(capture.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await capture.arrayBuffer()).toString(), 'capture-bytes');
    assert.equal((await app.request('/projects/p1/scene-map/scenes/L1/capture')).status, 404);
    assert.equal((await app.request('/projects/p1/scene-map/scenes/X1/capture')).status, 404);

    identify('reader');
    assert.equal((await read()).canEdit, false);
    assert.equal((await put({ positions: [{ layoutId: 'L1', x: 0, y: 0 }] })).status, 403);
  } finally { sqlite.close(); }
});
