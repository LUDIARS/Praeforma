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

test('PF-DR-7 arranges the same relations on a circle without changing their direction', () => {
  const circle = domainGraph('Praeforma', domains, memberships, 'circle');
  // 分類ごとにまとめて円周へ並べるので、同じ分類が弧として隣り合う。
  assert.deepEqual(circle.nodes.map(node => node.groupId), ['core', 'business', 'unclassified']);
  assert.equal(circle.width, circle.height, 'a circle needs a square canvas');
  const center = circle.width / 2;
  const radius = (node: { x: number; y: number; width: number; height: number }): number =>
    Math.hypot(node.x + node.width / 2 - center, node.y + node.height / 2 - center);
  const radii = circle.nodes.map(radius);
  for (const value of radii) assert.ok(Math.abs(value - radii[0]!) < 0.001, 'every node sits on the same circle');
  // 先頭は真上。並びは登録順で決定的。
  const top = circle.nodes[0]!;
  assert.ok(Math.abs(top.x + top.width / 2 - center) < 0.001, 'the first node is at the top');
  assert.ok(top.y < center, 'the first node is above the centre');
  // 関係の本数・向き・実線破線は配置で変わらない。
  assert.deepEqual(circle.edges.map(edge => [edge.from, edge.to, edge.dashed]),
    domainGraph('Praeforma', domains, memberships).edges.map(edge => [edge.from, edge.to, edge.dashed]));
  const edge = circle.edges[0]!;
  assert.equal(edge.points.length, GRAPH_EDGE_SEGMENTS + 1);
  // 経路はノードの外周から始まる。箱の下から線が出ない。
  const from = circle.nodes.find(node => node.id === edge.from)!;
  const begin = edge.points[0]!;
  assert.ok(Math.abs(begin.x - (from.x + from.width / 2)) <= from.width / 2 + 0.001,
    'the route starts within the node width');
  assert.ok(Math.abs(begin.y - (from.y + from.height / 2)) <= from.height / 2 + 0.001,
    'the route starts within the node height');
});

test('PF-DR-7 keeps nodes apart and edges distinguishable at 2 / 3 / 8 / 32 / 128 domains', () => {
  for (const count of [2, 3, 8, 32, TELA_GRAPH_MAX_NODES]) {
    const many = Array.from({ length: count }, (_, index) => domain(`d${index}`, `D${index}`, 'core'));
    // 隣どうしと、半周先への関係を張る (束になりやすい組み合わせ)。
    const relations = Array.from({ length: count }, (_, index) => ({ coreId: `d${index}`, businessId: `d${(index + 1) % count}` }));
    const graph = domainGraph('Praeforma', many, relations, 'circle');
    const center = graph.width / 2;

    // ノードの箱がどの組でも重ならない。
    for (let a = 0; a < graph.nodes.length; ++a) {
      for (let b = a + 1; b < graph.nodes.length; ++b) {
        const p = graph.nodes[a]!, q = graph.nodes[b]!;
        const apart = p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y;
        assert.ok(apart, `${count} domains: ${p.id} and ${q.id} overlap`);
      }
    }

    // 辺の中点が中心の 1 点に集まらない。隣どうしの辺は円周寄りを通り、互いに離れている。
    const radius = Math.hypot(graph.nodes[0]!.x + graph.nodes[0]!.width / 2 - center, graph.nodes[0]!.y + graph.nodes[0]!.height / 2 - center);
    const middles = graph.edges.map(edge => edge.points[GRAPH_EDGE_SEGMENTS / 2]!);
    if (count >= 3) {
      for (const middle of middles) {
        assert.ok(Math.hypot(middle.x - center, middle.y - center) > radius * 0.25,
          `${count} domains: a neighbour edge passes through the centre`);
      }
      const distinct = new Set(middles.map(point => `${Math.round(point.x)}:${Math.round(point.y)}`));
      assert.equal(distinct.size, middles.length, `${count} domains: two edges share the same middle`);
    }
  }
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
