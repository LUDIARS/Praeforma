// 遷移図キャンバスの配置・矢印・保存入力・キャプチャ選び — spec/feature/scene-map.md PF-MAP-7〜11
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutScenes, sceneEdges, scenePositionsSchema, SCENE_NODE_WIDTH } from '../../../../shared/scene-map-layout.ts';
import type { SceneMapScene } from '../../../../shared/project-home.ts';
import { pickCapture } from '../scene-capture.ts';
import { buildSceneMap } from '../scene-map.ts';
import { parseDisposition } from '../fragment-disposition-param.ts';

const scene = (id: string, extra: Partial<SceneMapScene> = {}): SceneMapScene => ({
  id, name: id, description: null, kind: 'ui-2d', isDefault: false, imported: false, specs: [], outgoing: [],
  incomingCount: 0, position: null, hasCapture: false, ...extra,
});
const go = (id: string, to: string, label: string | null = null) => ({ id, toLayoutId: to, toName: to, trigger: 'tap', condition: '', label });

test('layoutScenes: 最初のシーンからたどった深さを列にし、たどれないシーンは最後の列', () => {
  const positions = layoutScenes([
    scene('title', { isDefault: true, outgoing: [go('t1', 'menu')] }),
    scene('menu', { incomingCount: 1, outgoing: [go('t2', 'shop'), go('t3', 'battle')] }),
    scene('shop', { incomingCount: 1 }), scene('battle', { incomingCount: 1 }), scene('orphan'),
  ]);
  const column = (id: string) => Math.round((positions.get(id)!.x - 40) / (SCENE_NODE_WIDTH + 120));
  assert.deepEqual(['title', 'menu', 'shop', 'battle', 'orphan'].map(column), [0, 1, 2, 2, 3]);
  assert.notEqual(positions.get('shop')!.y, positions.get('battle')!.y);
});

test('layoutScenes: 保存済みの位置はそのまま使い、自動配置はその下へずらす', () => {
  const positions = layoutScenes([scene('a', { isDefault: true, position: { x: 500, y: 900 } }), scene('b')]);
  assert.deepEqual(positions.get('a'), { x: 500, y: 900 });
  assert.ok(positions.get('b')!.y > 900);
});

test('sceneEdges: 同じ向きの遷移は 1 本にまとめ件数を数える。逆向きは別の線', () => {
  const edges = sceneEdges([
    scene('a', { outgoing: [go('1', 'b', '開始'), go('2', 'b')] }), scene('b', { outgoing: [go('3', 'a')] }),
  ]);
  assert.deepEqual(edges.map((e) => [e.from, e.to, e.label, e.count]), [['a', 'b', '開始', 2], ['b', 'a', 'tap', 1]]);
});

test('scenePositionsSchema: 重複・範囲外・空を拒否する', () => {
  assert.equal(scenePositionsSchema.safeParse({ positions: [{ layoutId: 'a', x: 1, y: 2 }] }).success, true);
  assert.equal(scenePositionsSchema.safeParse({ positions: [] }).success, false);
  assert.equal(scenePositionsSchema.safeParse({ positions: [{ layoutId: 'a', x: 1, y: 2 }, { layoutId: 'a', x: 3, y: 4 }] }).success, false);
  assert.equal(scenePositionsSchema.safeParse({ positions: [{ layoutId: 'a', x: 1e6, y: 0 }] }).success, false);
  assert.equal(scenePositionsSchema.safeParse({ positions: [{ layoutId: 'a', x: 0, y: 0, extra: 1 }] }).success, false);
});

test('pickCapture: 先頭フレームの画像を選び、無いフレームの資料は使わない', () => {
  const png = Buffer.from('png-bytes').toString('base64');
  const jpg = Buffer.from('jpg-bytes').toString('base64');
  const frame = (id: string) => ({ id, name: id, description: '', states: [], x: 0, y: 0, width: 10, height: 10, viewport: { width: 10, height: 10 } });
  const source = (id: string, frameId: string, image: string | null) => ({ id, frameId, fingerprint: null, image, runtime: null, notes: [] });
  const capture = pickCapture({
    canvas: { revision: 1, frames: [frame('f1'), frame('f2')], elements: [], transitions: [] },
    sources: [source('s0', 'gone', `data:image/png;base64,${png}`), source('s2', 'f2', `data:image/png;base64,${png}`), source('s1', 'f1', `data:image/jpeg;base64,${jpg}`)],
  } as never);
  assert.equal(capture!.contentType, 'image/jpeg');
  assert.equal(Buffer.from(capture!.body).toString(), 'jpg-bytes');
  assert.equal(pickCapture({ canvas: { revision: 0, frames: [frame('f1')], elements: [], transitions: [] }, sources: [source('s', 'f1', null)] } as never), null);
});

test('buildSceneMap: 位置・キャプチャ・編集可否を載せる', () => {
  const map = buildSceneMap({
    layouts: [{ id: 'L1', name: 'タイトル', description: null, kind: 'ui-2d', isDefault: true, anatomiaSceneId: null },
      { id: 'L2', name: 'ショップ', description: null, kind: 'ui-2d', isDefault: false, anatomiaSceneId: null }],
    transitions: [], specs: [], targets: [], placements: [],
    positions: new Map([['L1', { x: 10, y: 20 }]]), captures: new Set(['L2']), canEdit: true,
  });
  assert.deepEqual(map.scenes.map((s) => [s.id, s.position, s.hasCapture]), [['L1', { x: 10, y: 20 }, false], ['L2', null, true]]);
  assert.equal(map.canEdit, true);
});

test('parseDisposition: 3 種類だけを受け、空は絞り込みなし', () => {
  assert.equal(parseDisposition(undefined), null);
  assert.equal(parseDisposition(''), null);
  assert.equal(parseDisposition('rejected'), 'rejected');
  assert.throws(() => parseDisposition('all'));
});
