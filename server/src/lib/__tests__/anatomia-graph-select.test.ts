import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_GRAPH_NODES, selectAnatomiaGraph } from '../anatomia-graph/select.ts';
import type { AnatomiaGraph } from '../anatomia-graph/types.ts';

const graph: AnatomiaGraph = {
  nodes: [
    { id: 'a1', name: 'movePlayer', kind: 'function', path: '/src/player/move.ts' },
    { id: 'a2', name: 'applyVelocity', kind: 'function', path: '/src/player/physics.ts' },
    { id: 'a3', name: 'spawnEnemy', kind: 'function', path: '/src/enemy/spawn.ts' },
    { id: 'a4', name: 'PlayerConfig', kind: 'file', path: '/src/player/config.ts' },
  ],
  edges: [{ from: 'a1', to: 'a2', kind: 'calls' }, { from: 'a1', to: 'a3', kind: 'calls' }, { from: 'a2', to: 'a4', kind: 'reads' }],
};

test('selectAnatomiaGraph: uses the same domain/query fixture as the retired relay selection', () => {
  const result = selectAnatomiaGraph({ graph, implementorsByDomain: { Player: ['a1', 'a2', 'a4'] }, target: { kind: 'domain', name: 'player' }, query: '' });
  assert.deepEqual(result.nodes.map((node) => node.key).sort(), ['a1', 'a2', 'a4']);
  assert.deepEqual(result.edges, [{ from: 'a1', to: 'a2', relation: 'calls' }, { from: 'a2', to: 'a4', relation: 'related' }]);
  assert.equal(result.nodes.find((node) => node.key === 'a4')?.type, 'file');
});

test('selectAnatomiaGraph: unites literal query matches, exposes absent domains, and reports truncation', () => {
  assert.deepEqual(
    selectAnatomiaGraph({ graph, implementorsByDomain: {}, target: { kind: 'layout', name: 'scene' }, query: 'enemy spawn' }).nodes.map((node) => node.key),
    ['a3'],
  );
  assert.ok(selectAnatomiaGraph({ graph, implementorsByDomain: {}, target: { kind: 'domain', name: 'Unknown' }, query: '' }).summary.includes('検出ドメインに無し'));
  const many: AnatomiaGraph = { nodes: Array.from({ length: MAX_GRAPH_NODES + 1 }, (_, index) => ({ id: `n${index}`, name: `fn${index}`, kind: 'function', path: '/src/x.ts' })), edges: [] };
  assert.ok(selectAnatomiaGraph({ graph: many, implementorsByDomain: { Big: many.nodes.map((node) => node.id) }, target: { kind: 'domain', name: 'Big' }, query: '' }).summary.includes('切り詰め'));
});

test('selectAnatomiaGraph: preserves non-ASCII search terms used by the default Studio query', () => {
  const localized: AnatomiaGraph = {
    nodes: [{ id: 'j1', name: 'プレイヤー移動', kind: 'function', path: '/src/player.ts' }],
    edges: [],
  };
  const result = selectAnatomiaGraph({
    graph: localized,
    implementorsByDomain: {},
    target: { kind: 'layout', name: '操作画面' },
    query: 'プレイヤー移動 の関連処理',
  });
  assert.deepEqual(result.nodes.map((node) => node.key), ['j1']);
});
