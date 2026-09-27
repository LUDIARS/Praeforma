import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

process.env.PRAEFORMA_LOCAL_MODE = '1';

test('SQLite roundtrip keeps categories, rejects foreign scenes, and invalidates evidence after base edits', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { layouts } = await import('../../db/schema/layout.ts');
  const { sceneDocuments } = await import('../../db/schema/scene-editor.ts');
  const { seedScene } = await import('../scene-seed.ts');
  const { uxScenarios, uxCanvases, uxEvidence } = await import('../../db/schema/ux-design.ts');
  const { createScenarioWithCanvas } = await import('../../db/ux-design-persistence.ts');
  const { scenarioScenesCurrent } = await import('../scenario-scene-freshness.ts');
  const { assertScenarioSceneReferences } = await import('../scenario-scene-references.ts');
  const { makeReviewOverlayRouter } = await import('../../routes/review-overlay.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:'); assert.equal(state.ok, true, state.error ?? undefined);
  const sqlite = getLocalSqlite() as unknown as { close(): void };
  try {
    const db = getDb();
    await db.insert(projects).values([{ id: 'p', name: '庭', orgId: 'a', ownerUserId: 'reader' }, { id: 'foreign', name: '別作品', orgId: 'b', ownerUserId: 'other' }]);
    await db.insert(projectMembers).values({ id: 'm', projectId: 'p', userId: 'reader', role: 'viewer' });
    await db.insert(layouts).values([{ id: 'garden', projectId: 'p', name: 'Garden' }, { id: 'other-scene', projectId: 'foreign', name: 'Garden' }]);
    await createScenarioWithCanvas({ id: 's', projectId: 'p', name: '朝', actor: '見る人', category: 'expression',
      experience: '穏やかな朝', visualDirection: '淡い光', goal: '夜明けを眺める', successOutcome: '朝を感じる', createdBy: 'reader' }, { scenarioId: 's', updatedBy: 'reader' });
    const [stored] = await db.select().from(uxScenarios);
    assert.equal(stored?.category, 'expression'); assert.equal(stored?.experience, '穏やかな朝');
    const frame = { id: 'f', name: '庭', description: '', states: [], x: 0, y: 0, width: 1280, height: 720,
      viewport: { width: 1280, height: 720 }, scene_ref: { layout_id: 'garden', frame_id: 'legacy-frame', revision: 0 } };
    await assertScenarioSceneReferences('p', [frame]);
    await assert.rejects(assertScenarioSceneReferences('p', [{ ...frame, scene_ref: { ...frame.scene_ref, layout_id: 'other-scene' } }]));
    await db.update(uxCanvases).set({ frames: [frame] });
    assert.equal(await scenarioScenesCurrent('p', [frame]), true);
    assert.equal(await scenarioScenesCurrent('p', [{ ...frame, scene_ref: { ...frame.scene_ref, revision: 1 } }]), false);
    await db.insert(uxEvidence).values({ id: 'e', scenarioId: 's', targetKind: 'scenario', targetId: 's', kind: 'test',
      sourceProjectKey: 'p', sourceRevision: 'commit', sourceRef: 'report', status: 'passed', scenarioRevision: 1, canvasRevision: 1, recordedBy: 'reader' });
    const app = new Hono(); app.onError(error => new Response(JSON.stringify({ error: error.message }), { status: error instanceof AppError ? error.status : 500 }));
    app.route('/api/projects/:pid/review-overlay', makeReviewOverlayRouter());
    enableLocalAuth({ userId: 'reader', displayName: null, role: 'user', projectKey: null });
    const response = await app.request('/api/projects/p/review-overlay?layout_id=garden');
    assert.equal(response.status, 200);
    const body = await response.json() as { scenarios: Array<{ category: string; evidence: Array<{ isStale: boolean }> }> };
    assert.equal(body.scenarios[0]?.category, 'expression'); assert.equal(body.scenarios[0]?.evidence[0]?.isStale, false);
    const manifestResponse = await app.request('/api/projects/p/review-overlay/manifest');
    assert.equal(manifestResponse.status, 200);
    const manifest = await manifestResponse.json() as { teamId: string; subjects: Array<{ id: string; revision: string }> };
    assert.equal(manifest.teamId, 'a');
    assert.equal(manifest.subjects[0]?.id, 's');
    assert.equal((await app.request('/api/projects/foreign/review-overlay/manifest')).status, 403);
    const changed = await seedScene('p', 'garden', 'Garden');
    changed.canvas.revision = 1;
    await db.insert(sceneDocuments).values({ layoutId: 'garden', projectId: 'p', payload: changed, revision: 1, updatedAt: new Date() });
    const afterEdit = await app.request('/api/projects/p/review-overlay?layout_id=garden');
    const changedBody = await afterEdit.json() as typeof body;
    assert.equal(changedBody.scenarios[0]?.evidence[0]?.isStale, true);
    const nextManifest = await (await app.request('/api/projects/p/review-overlay/manifest')).json() as typeof manifest;
    assert.notEqual(nextManifest.subjects[0]?.revision, manifest.subjects[0]?.revision);
    assert.equal((await app.request('/api/projects/p/review-overlay?layout_id=other-scene')).status, 404);
    assert.equal((await app.request('/api/projects/foreign/review-overlay')).status, 403);
  } finally { sqlite.close(); }
});
