/**
 * ドメイン関係図の配置 (PF-DR-4)。画面の SVG と Tela への書き出しが同じ絵になるよう、
 * ノードの位置と辺の経路をここだけで決める。
 */
// @spec PF-DR-4 ドメイン関係図の配置
import { domainRelations, type DomainMembership, type RelationDomain } from './domain-relations.ts';

export interface GraphDomain extends RelationDomain { name: string }
export interface GraphGroup { id: string; name: string; color: string }
export interface GraphNode { groupId: string; id: string; label: string; x: number; y: number; width: number; height: number }
export interface GraphEdge { id: string; from: string; to: string; dashed: boolean; points: readonly { x: number; y: number }[] }
export interface DomainGraph {
  project: string; title: string;
  width: number; height: number;
  groups: readonly GraphGroup[];
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}

export const GRAPH_NODE_WIDTH = 220, GRAPH_NODE_HEIGHT = 80;
const COLUMN_GAP = 340, ROW_GAP = 120, LEFT = 40, TOP = 60, HEADING = 30;
const CANVAS_WIDTH = 1040, MINIMUM_HEIGHT = 200;
/** 辺は曲線で描く。画面と Tela で同じ形にするため、刻み数もここで決める。 */
export const GRAPH_EDGE_SEGMENTS = 16;

/** 分類ごとの列。色は Tela の描画とも共有する。 */
export const GRAPH_GROUPS: readonly (GraphGroup & { kind: 'core' | 'business' | null })[] = [
  { id: 'core', kind: 'core', name: 'コアドメイン', color: '#8054bd' },
  { id: 'business', kind: 'business', name: 'ビジネスドメイン', color: '#286fa8' },
  { id: 'unclassified', kind: null, name: '未分類', color: '#67717e' },
];

interface Placed { x: number; y: number; groupId: string }

const cubic = (a: number, b: number, c: number, d: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/** 画面と同じ折れ線へ落とす。制御点は SVG の C コマンドと同じもの。 */
function route(from: Placed, to: Placed): { x: number; y: number }[] {
  const x1 = from.x + GRAPH_NODE_WIDTH;
  const x2 = to.x > from.x ? to.x : to.x + GRAPH_NODE_WIDTH;
  const bend = to.x > from.x ? (x1 + x2) / 2 : Math.max(x1, x2) + 70;
  const y1 = from.y + GRAPH_NODE_HEIGHT / 2, y2 = to.y + GRAPH_NODE_HEIGHT / 2;
  const points: { x: number; y: number }[] = [];
  for (let step = 0; step <= GRAPH_EDGE_SEGMENTS; ++step) {
    const t = step / GRAPH_EDGE_SEGMENTS;
    points.push({ x: cubic(x1, bend, bend, x2, t), y: cubic(y1, y1, y2, y2, t) });
  }
  return points;
}

/** 分類ごとに縦へ積み、所属(実線)と親子(破線)を結ぶ。並びは登録順で決定的。 */
export function domainGraph(
  project: string, domains: readonly GraphDomain[], memberships: readonly DomainMembership[],
): DomainGraph {
  const placed = new Map<string, Placed>();
  const nodes: GraphNode[] = [];
  const groups: GraphGroup[] = [];
  let height = MINIMUM_HEIGHT;
  GRAPH_GROUPS.forEach((group, column) => {
    const members = domains.filter(domain => domain.definitionKind === group.kind);
    if (members.length === 0) return;
    groups.push({ id: group.id, name: group.name, color: group.color });
    height = Math.max(height, TOP + members.length * ROW_GAP + HEADING);
    members.forEach((domain, row) => {
      const x = LEFT + column * COLUMN_GAP, y = TOP + row * ROW_GAP;
      placed.set(domain.id, { x, y, groupId: group.id });
      nodes.push({ groupId: group.id, id: domain.id, label: domain.name, x, y, width: GRAPH_NODE_WIDTH, height: GRAPH_NODE_HEIGHT });
    });
  });
  const edges: GraphEdge[] = [];
  for (const relation of domainRelations([...domains], [...memberships])) {
    const from = placed.get(relation.from), to = placed.get(relation.to);
    if (!from || !to) continue;
    edges.push({
      id: `${relation.from}:${relation.to}`, from: relation.from, to: relation.to,
      dashed: relation.kind === 'parent', points: route(from, to),
    });
  }
  return { project, title: 'ドメイン関係図', width: CANVAS_WIDTH, height, groups, nodes, edges };
}
