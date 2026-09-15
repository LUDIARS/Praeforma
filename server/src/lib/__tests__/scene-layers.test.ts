import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { sceneSaveSchema } from '../../../../shared/scene-editor.ts';
import { fitFrame, MAX_LAYERS_PER_FRAME } from '../../../../shared/scene-layers.ts';
import { telaSceneOverlay, TELA_OVERLAY_MAX_ELEMENTS } from '../../../../shared/tela-scene-overlay-export.ts';

process.env.PRAEFORMA_LOCAL_MODE='1';
const frame = { id: 'base', name: 'Battle', description: '', states: [], x: 0, y: 0, width: 1000, height: 500, viewport: { width: 1000, height: 500 } };
const element = (id: string, frameId: string, x = 10) => ({ id, frame_id: frameId, kind: 'button' as const, label: id, x, y: 20, width: 100, height: 40, sample_text: null, dynamic: null, follow: null });
const canvas = { expected_revision: 0, frames: [frame], elements: [element('attack', 'base')], transitions: [] };
const layer = (id: string, layoutId = 'menu', layoutFrameId = 'menu-frame') => ({ id, frameId: 'base', layoutId, layoutFrameId });

test('PF-SCENE-8 layers are optional and ordered, and reject unknown frames, duplicates, extra fields and overflow', () => {
  assert.equal(sceneSaveSchema.safeParse({ canvas, sources: [] }).success, true);
  const input = { canvas, sources: [], layers: [layer('a'), layer('b', 'dialog')] };
  assert.deepEqual(sceneSaveSchema.parse(JSON.parse(JSON.stringify(input))).layers, input.layers);
  const accepts = (layers: unknown[]) => sceneSaveSchema.safeParse({ canvas, sources: [], layers }).success;
  assert.equal(accepts([{ ...layer('a'), frameId: 'missing' }]), false);
  assert.equal(accepts([layer('a'), layer('a', 'dialog')]), false);
  assert.equal(accepts([layer('a'), layer('b')]), false);
  assert.equal(accepts([{ ...layer('a'), visible: true }]), false);
  assert.equal(accepts(Array.from({ length: MAX_LAYERS_PER_FRAME }, (_, index) => layer(`l${index}`, `scene${index}`))), true);
  assert.equal(accepts(Array.from({ length: MAX_LAYERS_PER_FRAME + 1 }, (_, index) => layer(`l${index}`, `scene${index}`))), false);
});

test('PF-SCENE-8 layered frames keep their aspect ratio and are centered', () => {
  assert.deepEqual(fitFrame({ width: 500, height: 500 }, { width: 1000, height: 500 }), { scale: 1, offsetX: 250, offsetY: 0 });
  assert.deepEqual(fitFrame({ width: 2000, height: 500 }, { width: 1000, height: 500 }), { scale: 0.5, offsetX: 0, offsetY: 125 });
});

test('PF-SCENE-8 Tela export escapes fields, keeps visibility and maps layers into base coordinates', () => {
  const menuFrame = { ...frame, id: 'menu-frame', name: 'Menu', width: 2000, height: 1000 };
  const text = telaSceneOverlay(
    { id: 'battle', name: 'Battle "main"', visible: true, frame, elements: [element('attack', 'base')] },
    [{ id: 'layer-1', name: 'Option\\Menu\nPC', visible: false, frame: menuFrame, elements: [{ ...element('close', 'menu-frame', 200), width: 300 }] }],
  );
  assert.deepEqual(text.split('\n'), [
    'TELA_SCENE_OVERLAY 1',
    'frame "Battle" 1000 500',
    'scene "battle" "Battle \\"main\\"" 1',
    'scene "layer-1" "Option\\\\Menu PC" 0',
    'element "battle" "attack" "button" "attack" 10 20 100 40',
    'element "layer-1" "close" "button" "close" 100 10 150 20',
    '',
  ]);
  const many = Array.from({ length: TELA_OVERLAY_MAX_ELEMENTS + 1 }, (_, index) => element(`e${index}`, 'base'));
  assert.throws(() => telaSceneOverlay({ id: 'battle', name: 'Battle', visible: true, frame, elements: many }, []));
});

test('PF-SCENE-8 layer references stay inside the project, exclude the scene itself and survive later deletion', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { layouts } = await import('../../db/schema/layout.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeSceneEditorRouter } = await import('../../routes/scene-editor.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:'); assert.equal(state.ok, true, state.error ?? undefined);
  const sqlite = getLocalSqlite() as unknown as { close(): void };
  try {
    enableLocalAuth({ userId: 'author', displayName: null, role: 'user', projectKey: null });
    await getDb().insert(projects).values([{ id: 'p', name: 'One', orgId: 'test', ownerUserId: 'author' }, { id: 'q', name: 'Two', orgId: 'test', ownerUserId: 'author' }]);
    await getDb().insert(projectMembers).values([{ id: 'a', projectId: 'p', userId: 'author', role: 'owner' }, { id: 'b', projectId: 'q', userId: 'author', role: 'owner' }]);
    await getDb().insert(layouts).values([
      { id: 'battle', projectId: 'p', name: 'Battle', kind: 'ui-2d' },
      { id: 'menu', projectId: 'p', name: 'Menu', kind: 'ui-2d' },
      { id: 'foreign', projectId: 'q', name: 'Foreign', kind: 'ui-2d' },
    ]);
    const app = new Hono(); app.onError(e => new Response(JSON.stringify({ error: e.message }), { status: e instanceof AppError ? e.status : 500 }));
    app.route('/projects/:pid/layouts/:lid/scene-editor', makeSceneEditorRouter('unused'));
    const route = '/projects/p/layouts/battle/scene-editor';
    const body = (layers: unknown[], expected = 0) => ({ canvas: { ...canvas, expected_revision: expected }, sources: [], layers });
    const save = (input: unknown) => app.request(route, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal((await save(body([layer('self', 'battle')]))).status, 400);
    assert.equal((await save(body([layer('other-project', 'foreign')]))).status, 400);
    assert.equal((await save(body([layer('unknown', 'nothing')]))).status, 400);
    assert.equal((await save(body([layer('menu')]))).status, 200);
    const saved = await (await app.request(route)).json() as { document: { layers?: unknown } };
    assert.deepEqual(saved.document.layers, [layer('menu')]);
    await getDb().update(layouts).set({ deletedAt: new Date() }).where(eq(layouts.id, 'menu'));
    assert.equal((await save(body([layer('menu')], 1))).status, 200);
    assert.equal((await save(body([], 2))).status, 200);
    const cleared = await (await app.request(route)).json() as { document: { layers?: unknown[] } };
    assert.deepEqual(cleared.document.layers, []);
  } finally { sqlite.close(); }
});
