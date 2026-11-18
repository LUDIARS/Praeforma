// 遷移図 (シーン中心) 集約の純関数テスト — spec/feature/scene-map.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneMap } from '../scene-map.ts';

const layout = (id: string, name: string, extra: Partial<{ isDefault: boolean; anatomiaSceneId: string | null }> = {}) =>
  ({ id, name, description: null, kind: 'ui-2d', isDefault: false, anatomiaSceneId: null, ...extra });
const spec = (id: string, code: string) => ({ id, code, title: `${code} title`, status: 'draft', priority: 'must' });

test('buildSceneMap: 既定シーンを先頭、残りは名前順。取り込み元があれば imported', () => {
  const map = buildSceneMap({
    layouts: [layout('b', 'ショップ'), layout('a', 'タイトル', { isDefault: true }), layout('c', 'バトル', { anatomiaSceneId: 'scene:battle' })],
    transitions: [], specs: [], targets: [], placements: [],
  });
  assert.deepEqual(map.scenes.map((s) => s.name), ['タイトル', ...['ショップ', 'バトル'].sort((x, y) => x.localeCompare(y, 'ja'))]);
  assert.equal(map.scenes.find((s) => s.id === 'c')!.imported, true);
  assert.equal(map.scenes.find((s) => s.id === 'b')!.imported, false);
});

test('buildSceneMap: シーン直付けとアクター経由の仕様を束ね、直付けを優先する', () => {
  const map = buildSceneMap({
    layouts: [layout('L1', 'タイトル'), layout('L2', 'ショップ')],
    transitions: [],
    specs: [spec('S1', 'PF-1'), spec('S2', 'PF-2'), spec('S3', 'PF-3')],
    targets: [
      { specId: 'S1', kind: 'layout', refId: 'L1' },
      { specId: 'S1', kind: 'object', refId: 'O1' },
      { specId: 'S2', kind: 'object', refId: 'O1' },
      { specId: 'S3', kind: 'domain', refId: 'D1' },
    ],
    placements: [{ layoutId: 'L1', objectId: 'O1' }, { layoutId: 'L2', objectId: 'O1' }],
  });
  const l1 = map.scenes.find((s) => s.id === 'L1')!;
  const l2 = map.scenes.find((s) => s.id === 'L2')!;
  assert.deepEqual(l1.specs.map((s) => [s.code, s.via]), [['PF-1', 'scene'], ['PF-2', 'actor']]);
  assert.deepEqual(l2.specs.map((s) => [s.code, s.via]), [['PF-1', 'actor'], ['PF-2', 'actor']]);
  assert.deepEqual(map.unplacedSpecs.map((s) => s.code), ['PF-3']);
});

test('buildSceneMap: 遷移は ordinal 順。存在しないシーンへの遷移・無い仕様の対象は無視', () => {
  const map = buildSceneMap({
    layouts: [layout('L1', 'タイトル'), layout('L2', 'ショップ')],
    transitions: [
      { id: 'T2', fromLayoutId: 'L1', toLayoutId: 'L2', trigger: 'tap', condition: '', label: '戻る', ordinal: 2 },
      { id: 'T1', fromLayoutId: 'L1', toLayoutId: 'L2', trigger: 'tap', condition: 'coin>0', label: '購入', ordinal: 1 },
      { id: 'T3', fromLayoutId: 'L1', toLayoutId: 'GONE', trigger: 'tap', condition: '', label: null, ordinal: 0 },
    ],
    specs: [],
    targets: [{ specId: 'NOPE', kind: 'layout', refId: 'L1' }],
    placements: [{ layoutId: 'GONE', objectId: 'O1' }],
  });
  const l1 = map.scenes.find((s) => s.id === 'L1')!;
  assert.deepEqual(l1.outgoing.map((t) => [t.id, t.toName]), [['T1', 'ショップ'], ['T2', 'ショップ']]);
  assert.equal(l1.specs.length, 0);
  assert.equal(map.scenes.find((s) => s.id === 'L2')!.incomingCount, 2);
});
