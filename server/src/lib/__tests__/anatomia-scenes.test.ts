// Anatomia の解析シーン → シーン登録候補 (spec/feature/anatomia-scene-proposals.md)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAnatomiaScenes, suggestLayoutKind, toSceneProposals } from '../anatomia-scenes.ts';
import { AppError } from '../errors.ts';

const scene = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  label: `Scene ${id}`,
  kind: 'screen',
  origin: 'static-code',
  tombstone: false,
  sourceAnchor: { path: `src/scenes/${id}.ts`, startLine: 3, endLine: 40, detector: 'scene-class', reason: 'extends Scene' },
  annotation: null,
  ...overrides,
});

test('toSceneProposals: shows source id, name and evidence, and excludes tombstoned scenes', () => {
  const list = toSceneProposals({ scenes: [scene('title'), scene('gone', { tombstone: true })], stale: false, staleReasons: [] }, new Map());
  assert.equal(list.proposals.length, 1);
  assert.deepEqual(list.proposals[0], {
    scene_id: 'title',
    label: 'Scene title',
    kind: 'screen',
    origin: 'static-code',
    suggested_kind: 'ui-2d',
    evidence: { path: 'src/scenes/title.ts', start_line: 3, end_line: 40, detector: 'scene-class', reason: 'extends Scene' },
    description: null,
    registered_layout_id: null,
  });
});

test('toSceneProposals: keeps the registration mapping so a refetch does not offer a registered scene again', () => {
  const list = toSceneProposals({ scenes: [scene('b'), scene('a')] }, new Map([['b', 'layout-1']]));
  assert.deepEqual(list.proposals.map((p) => [p.scene_id, p.registered_layout_id]), [['a', null], ['b', 'layout-1']]);
});

test('toSceneProposals: prefers the Anatomia annotation, reports staleness, and dedupes ids', () => {
  const list = toSceneProposals({
    scenes: [scene('x', { annotation: { label: 'タイトル画面', description: '起動直後の画面' } }), scene('x')],
    stale: true,
    staleReasons: ['source revision changed'],
  }, new Map());
  assert.equal(list.proposals.length, 1);
  assert.equal(list.proposals[0]!.label, 'タイトル画面');
  assert.equal(list.proposals[0]!.description, '起動直後の画面');
  assert.equal(list.stale, true);
  assert.deepEqual(list.stale_reasons, ['source revision changed']);
});

test('toSceneProposals: accepts the single-context `merged` shape and rejects a malformed payload', () => {
  assert.equal(toSceneProposals({ merged: [scene('m')] }, new Map()).proposals.length, 1);
  assert.throws(() => toSceneProposals({ nothing: true }, new Map()), (e: unknown) => e instanceof AppError && e.message === 'anatomia_bad_payload');
});

test('suggestLayoutKind: worlds become world layouts, screens and routes stay UI', () => {
  assert.equal(suggestLayoutKind('world', 'static-code'), 'world-3d');
  assert.equal(suggestLayoutKind('stage-2d', 'static-code'), 'world-2d');
  assert.equal(suggestLayoutKind('page', 'route'), 'ui-2d');
});

test('fetchAnatomiaScenes: distinguishes unconfigured, unreachable and unknown project', async () => {
  await assert.rejects(fetchAnatomiaScenes({ anatomiaUrl: null }, 'repo'), (e: unknown) => e instanceof AppError && e.message === 'anatomia_unconfigured');
  const unreachable: typeof fetch = async () => { throw new Error('ECONNREFUSED'); };
  await assert.rejects(fetchAnatomiaScenes({ anatomiaUrl: 'http://anatomia.example' }, 'repo', 1_000, unreachable),
    (e: unknown) => e instanceof AppError && e.message === 'anatomia_unreachable');
  const missing: typeof fetch = async () => new Response('{}', { status: 404 });
  await assert.rejects(fetchAnatomiaScenes({ anatomiaUrl: 'http://anatomia.example' }, 'repo', 1_000, missing),
    (e: unknown) => e instanceof AppError && e.message === 'anatomia_project_not_found');
  const calls: string[] = [];
  const ok: typeof fetch = async (input) => { calls.push(String(input)); return Response.json({ scenes: [] }); };
  assert.deepEqual(await fetchAnatomiaScenes({ anatomiaUrl: 'http://anatomia.example/' }, 'owner/repo', 1_000, ok), { scenes: [] });
  assert.deepEqual(calls, ['http://anatomia.example/api/projects/owner%2Frepo/scenes']);
});
