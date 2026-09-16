// @spec PF-DR-6 Tela 書き出し
import { telaCoordinate, telaField } from './tela-record-format.ts';
import type { DomainGraph } from './domain-graph.ts';

/** Tela の読み込み側と同じ上限。超過は切り詰めずに書き出しを失敗させる。 */
export const TELA_GRAPH_MAX_GROUPS = 8;
export const TELA_GRAPH_MAX_NODES = 128;
export const TELA_GRAPH_MAX_EDGES = 256;
export const TELA_GRAPH_MAX_POINTS = 4096;
const MINIMUM_EXPORTED_SIZE = 0.01;

const size = (value: number): string => telaCoordinate(Math.max(MINIMUM_EXPORTED_SIZE, value));
const channel = (hex: string, at: number): number => Number.parseInt(hex.slice(at, at + 2), 16);

/**
 * ドメイン関係図を `TELA_GRAPH 1` として直列化する。
 * 辺の経路は Pf が決めて折れ線で渡す。Tela 側で曲線を引き直さないので画面と同じ形になる。
 * visible は Tela 側のグループ切り替えの初期値であり、Pf へは書き戻らない。
 */
export function telaGraph(graph: DomainGraph, hidden: ReadonlySet<string> = new Set()): string {
  if (graph.nodes.length === 0) throw new Error('書き出せるドメインがありません。');
  if (graph.groups.length > TELA_GRAPH_MAX_GROUPS)
    throw new Error(`Tela へ書き出せる分類は${TELA_GRAPH_MAX_GROUPS}件までです。`);
  if (graph.nodes.length > TELA_GRAPH_MAX_NODES)
    throw new Error(`Tela へ書き出せるドメインは${TELA_GRAPH_MAX_NODES}件までです（現在${graph.nodes.length}件）。`);
  if (graph.edges.length > TELA_GRAPH_MAX_EDGES)
    throw new Error(`Tela へ書き出せる関係は${TELA_GRAPH_MAX_EDGES}件までです（現在${graph.edges.length}件）。`);
  const points = graph.edges.reduce((sum, edge) => sum + edge.points.length, 0);
  if (points > TELA_GRAPH_MAX_POINTS)
    throw new Error(`Tela へ書き出せる経路の点は${TELA_GRAPH_MAX_POINTS}個までです（現在${points}個）。`);
  const lines = [
    'TELA_GRAPH 1',
    `graph ${telaField(graph.project)} ${telaField(graph.title)} ${size(graph.width)} ${size(graph.height)}`,
  ];
  for (const group of graph.groups)
    lines.push(`group ${telaField(group.id)} ${telaField(group.name)} ${hidden.has(group.id) ? 0 : 1} `
      + `${channel(group.color, 1)} ${channel(group.color, 3)} ${channel(group.color, 5)}`);
  for (const node of graph.nodes)
    lines.push(['node', telaField(node.groupId), telaField(node.id), telaField(node.label),
      telaCoordinate(node.x), telaCoordinate(node.y), size(node.width), size(node.height)].join(' '));
  for (const edge of graph.edges) {
    lines.push(`edge ${telaField(edge.id)} ${telaField(edge.from)} ${telaField(edge.to)} ${edge.dashed ? 1 : 0}`);
    for (const point of edge.points)
      lines.push(`point ${telaField(edge.id)} ${telaCoordinate(point.x)} ${telaCoordinate(point.y)}`);
  }
  return `${lines.join('\n')}\n`;
}
