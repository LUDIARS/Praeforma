import type { GraphRelation } from '../../db/schema/code-graph.ts';
import type { AnatomiaGraph, GraphTarget, SelectedGraph } from './types.ts';

export const MAX_GRAPH_NODES = 300;

function relation(kind: string): GraphRelation {
  if (kind === 'calls') return 'calls';
  if (kind === 'depends' || kind === 'includes') return 'depends';
  if (kind === 'implements' || kind === 'overrides') return 'implements';
  return 'related';
}

function tokens(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((token) => token.length >= 2))];
}

/** Selects a bounded, deterministic graph using domain implementors and literal query matches. */
export function selectAnatomiaGraph(input: {
  graph: AnatomiaGraph;
  implementorsByDomain: Record<string, string[]>;
  target: GraphTarget;
  query: string;
}): SelectedGraph {
  const wantedDomain = input.target.kind === 'domain' ? input.target.name.trim().toLowerCase() : null;
  const domain = Object.keys(input.implementorsByDomain).find((name) => name.trim().toLowerCase() === wantedDomain);
  const anchors = new Set(domain ? input.implementorsByDomain[domain] : []);
  const queryTokens = tokens(input.query);
  const selected = new Set(anchors);
  for (const node of input.graph.nodes) {
    const haystack = `${node.name}\n${node.path}`.toLowerCase();
    if (queryTokens.some((token) => haystack.includes(token))) selected.add(node.id);
  }
  const candidates = input.graph.nodes.filter((node) => selected.has(node.id))
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const kept = candidates.slice(0, MAX_GRAPH_NODES);
  const keptIds = new Set(kept.map((node) => node.id));
  const seen = new Set<string>();
  const edges = input.graph.edges.flatMap((edge) => {
    if (!keptIds.has(edge.from) || !keptIds.has(edge.to)) return [];
    const mapped = relation(edge.kind);
    const key = `${edge.from}|${edge.to}|${mapped}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ from: edge.from, to: edge.to, relation: mapped }];
  });
  const reason = wantedDomain && !domain
    ? `ドメイン「${input.target.name}」は Anatomia の検出ドメインに無し`
    : domain
      ? `ドメイン「${domain}」の実装 ${anchors.size} 件をアンカー`
      : 'layout/transition 対象は検索語のみで照合';
  const limit = candidates.length > MAX_GRAPH_NODES ? ` / 上限 ${MAX_GRAPH_NODES} で切り詰め（候補 ${candidates.length}）` : '';
  return {
    nodes: kept.map((node) => ({
      key: node.id,
      label: node.name,
      type: node.kind === 'file' ? 'file' : 'symbol',
      anatomia_ref: { path: node.path, symbol: node.name, kind: node.kind },
    })),
    edges,
    summary: `${reason} / 検索語 ${queryTokens.length} 件 / ${kept.length === 0 ? '関連処理は見つからなかった' : `計 ${kept.length} ノードを返却`}${limit}`,
  };
}
