/**
 * ドメイン関係図の配置 (PF-DR-4)。画面の SVG と Tela への書き出しが同じ絵になるよう、
 * ノードの位置と辺の経路をここだけで決める。
 */
// @spec PF-DR-4 ドメイン関係図の配置 / PF-DR-7 円配置
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

/** 列に並べるか、円周に並べるか。関係の向きはどちらでも from → to。 */
export type GraphLayout = 'columns' | 'circle';
export const GRAPH_LAYOUTS: readonly (readonly [GraphLayout, string])[] = [['columns', '列'], ['circle', '円']];

export const GRAPH_NODE_WIDTH = 220, GRAPH_NODE_HEIGHT = 80;
const COLUMN_GAP = 340, ROW_GAP = 120, LEFT = 40, TOP = 60, HEADING = 30;
const CANVAS_WIDTH = 1040, MINIMUM_HEIGHT = 200;
/** 円配置はノードが重ならない半径を件数から決め、下限で小さすぎる円を避ける。 */
const CIRCLE_MINIMUM_RADIUS = 200, CIRCLE_MARGIN = 60;
/** 辺は曲線で描く。画面と Tela で同じ形にするため、刻み数もここで決める。 */
export const GRAPH_EDGE_SEGMENTS = 16;

/** 分類ごとの列。色は Tela の描画とも共有する。 */
export const GRAPH_GROUPS: readonly (GraphGroup & { kind: 'core' | 'business' | null })[] = [
  { id: 'core', kind: 'core', name: 'コアドメイン', color: '#8054bd' },
  { id: 'business', kind: 'business', name: 'ビジネスドメイン', color: '#286fa8' },
  { id: 'unclassified', kind: null, name: '未分類', color: '#67717e' },
];

interface Placed { x: number; y: number; groupId: string }
/** 配置は自分の経路の引き方も持つ。呼ぶ側が配置ごとの分岐を持たないようにするため。 */
interface Placement {
  placed: Map<string, Placed>;
  nodes: GraphNode[];
  groups: GraphGroup[];
  width: number;
  height: number;
  route(from: Placed, to: Placed): Point[];
}
interface Point { x: number; y: number }

const cubic = (a: number, b: number, c: number, d: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

function sample(from: Point, control1: Point, control2: Point, to: Point): Point[] {
  const points: Point[] = [];
  for (let step = 0; step <= GRAPH_EDGE_SEGMENTS; ++step) {
    const t = step / GRAPH_EDGE_SEGMENTS;
    points.push({ x: cubic(from.x, control1.x, control2.x, to.x, t), y: cubic(from.y, control1.y, control2.y, to.y, t) });
  }
  return points;
}

/** 列配置の経路。制御点は SVG の C コマンドと同じもの。 */
function columnRoute(from: Placed, to: Placed): Point[] {
  const x1 = from.x + GRAPH_NODE_WIDTH;
  const x2 = to.x > from.x ? to.x : to.x + GRAPH_NODE_WIDTH;
  const bend = to.x > from.x ? (x1 + x2) / 2 : Math.max(x1, x2) + 70;
  const y1 = from.y + GRAPH_NODE_HEIGHT / 2, y2 = to.y + GRAPH_NODE_HEIGHT / 2;
  return sample({ x: x1, y: y1 }, { x: bend, y: y1 }, { x: bend, y: y2 }, { x: x2, y: y2 });
}

/** ノード中心から目標へ向かう線が、ノードの矩形と交わる点。辺を箱の外から始める。 */
function exit(node: Placed, toward: Point): Point {
  const cx = node.x + GRAPH_NODE_WIDTH / 2, cy = node.y + GRAPH_NODE_HEIGHT / 2;
  const dx = toward.x - cx, dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = Math.min(
    dx === 0 ? Infinity : GRAPH_NODE_WIDTH / 2 / Math.abs(dx),
    dy === 0 ? Infinity : GRAPH_NODE_HEIGHT / 2 / Math.abs(dy),
  );
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/** 円配置の経路。両端の制御点を円の中心に置いて内側へ弓なりにする。 */
function circleRoute(from: Placed, to: Placed, center: Point): Point[] {
  const start = exit(from, center), end = exit(to, center);
  return sample(start, center, center, end);
}

function placeColumns(domains: readonly GraphDomain[]): Placement {
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
  return { placed, nodes, groups, width: CANVAS_WIDTH, height, route: columnRoute };
}

function placeCircle(domains: readonly GraphDomain[]): Placement {
  const placed = new Map<string, Placed>();
  const nodes: GraphNode[] = [];
  const groups: GraphGroup[] = [];
  // 分類ごとにまとめて円周へ並べるので、同じ分類が弧として隣り合う。
  const ordered: { domain: GraphDomain; groupId: string }[] = [];
  for (const group of GRAPH_GROUPS) {
    const members = domains.filter(domain => domain.definitionKind === group.kind);
    if (members.length === 0) continue;
    groups.push({ id: group.id, name: group.name, color: group.color });
    for (const domain of members) ordered.push({ domain, groupId: group.id });
  }
  const count = ordered.length;
  // 隣り合うノードが重ならない半径。1 件なら円にならないので下限を使う。
  const spacing = (GRAPH_NODE_WIDTH + 40) * count / (2 * Math.PI);
  const radius = Math.max(CIRCLE_MINIMUM_RADIUS, count > 1 ? spacing : 0);
  const extent = radius + Math.max(GRAPH_NODE_WIDTH, GRAPH_NODE_HEIGHT) / 2 + CIRCLE_MARGIN;
  const center = { x: extent, y: extent };
  ordered.forEach((entry, index) => {
    // 真上から時計回り。並びは登録順で決定的。
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(1, count);
    const x = center.x + radius * Math.cos(angle) - GRAPH_NODE_WIDTH / 2;
    const y = center.y + radius * Math.sin(angle) - GRAPH_NODE_HEIGHT / 2;
    placed.set(entry.domain.id, { x, y, groupId: entry.groupId });
    nodes.push({ groupId: entry.groupId, id: entry.domain.id, label: entry.domain.name, x, y, width: GRAPH_NODE_WIDTH, height: GRAPH_NODE_HEIGHT });
  });
  return { placed, nodes, groups, width: extent * 2, height: extent * 2, route: (from, to) => circleRoute(from, to, center) };
}

/**
 * 選んだ配置でノードを置き、所属(実線)と親子(破線)を from → to の向きで結ぶ。
 * 並びは登録順で決定的。空の分類は出さない。
 */
export function domainGraph(
  project: string, domains: readonly GraphDomain[], memberships: readonly DomainMembership[],
  layout: GraphLayout = 'columns',
): DomainGraph {
  const placement = layout === 'circle' ? placeCircle(domains) : placeColumns(domains);
  const edges: GraphEdge[] = [];
  for (const relation of domainRelations([...domains], [...memberships])) {
    const from = placement.placed.get(relation.from), to = placement.placed.get(relation.to);
    if (!from || !to) continue;
    edges.push({
      id: `${relation.from}:${relation.to}`, from: relation.from, to: relation.to,
      dashed: relation.kind === 'parent',
      points: placement.route(from, to),
    });
  }
  return {
    project, title: 'ドメイン関係図',
    width: placement.width, height: placement.height,
    groups: placement.groups, nodes: placement.nodes, edges,
  };
}
