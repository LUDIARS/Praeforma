import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domainGraph, GRAPH_EDGE_SEGMENTS, type GraphDomain } from '../../../../shared/domain-graph.ts';
import { telaGraph, TELA_GRAPH_MAX_NODES } from '../../../../shared/tela-graph-export.ts';

const domain = (id: string, name: string, kind: GraphDomain['definitionKind'], parentId: string | null = null): GraphDomain =>
  ({ id, name, definitionKind: kind, parentId });

// Tela の契約テスト (tests/graph_test.cpp) と同じバイト列。
const domains: GraphDomain[] = [
  domain('core-1', 'コア "A"', 'core'),
  domain('biz-1', 'ビジネス\\B', 'business', 'core-1'),
  domain('loose', '未分類C', null),
];
const memberships = [{ coreId: 'core-1', businessId: 'biz-1' }];

test('PF-DR-4 lays domains out per classification and routes every relation', () => {
  const graph = domainGraph('Praeforma', domains, memberships);
  assert.deepEqual(graph.groups.map(group => group.id), ['core', 'business', 'unclassified']);
  assert.deepEqual(graph.nodes.map(node => [node.id, node.x, node.y]), [
    ['core-1', 40, 60],
    ['biz-1', 380, 60],
    ['loose', 720, 60],
  ]);
  assert.equal(graph.width, 1040);
  // 所属は実線、親子は破線。同じ組に両方あるときは所属が残る。
  assert.deepEqual(graph.edges.map(edge => [edge.from, edge.to, edge.dashed]), [['core-1', 'biz-1', false]]);
  assert.equal(graph.edges[0]!.points.length, GRAPH_EDGE_SEGMENTS + 1);
  assert.deepEqual(graph.edges[0]!.points[0], { x: 260, y: 100 });
  assert.deepEqual(graph.edges[0]!.points.at(-1), { x: 380, y: 100 });
  // 空の分類は列に出さない。
  const onlyCore = domainGraph('Praeforma', [domain('core-1', 'A', 'core')], []);
  assert.deepEqual(onlyCore.groups.map(group => group.id), ['core']);
});

test('PF-DR-4 exports TELA_GRAPH 1 with escaped labels and rejects overflow', () => {
  const text = telaGraph(domainGraph('Praeforma', domains, memberships));
  const lines = text.split('\n');
  assert.equal(lines[0], 'TELA_GRAPH 1');
  assert.equal(lines[1], 'graph "Praeforma" "ドメイン関係図" 1040 210');
  assert.equal(lines[2], 'group "core" "コアドメイン" 1 128 84 189');
  assert.equal(lines[5], 'node "core" "core-1" "コア \\"A\\"" 40 60 220 80');
  assert.equal(lines[6], 'node "business" "biz-1" "ビジネス\\\\B" 380 60 220 80');
  assert.equal(lines[8], 'edge "core-1:biz-1" "core-1" "biz-1" 0');
  assert.equal(lines[9], 'point "core-1:biz-1" 260 100');
  assert.equal(lines.at(-2), 'point "core-1:biz-1" 380 100');

  // 非表示は Tela 側の切り替えの初期値として 0 で出る。
  const hidden = telaGraph(domainGraph('Praeforma', domains, memberships), new Set(['unclassified']));
  assert.equal(hidden.includes('group "unclassified" "未分類" 0 103 113 126'), true);

  assert.throws(() => telaGraph(domainGraph('Praeforma', [], [])));
  const many = Array.from({ length: TELA_GRAPH_MAX_NODES + 1 }, (_, index) => domain(`d${index}`, `D${index}`, 'core'));
  assert.throws(() => telaGraph(domainGraph('Praeforma', many, [])));
});
