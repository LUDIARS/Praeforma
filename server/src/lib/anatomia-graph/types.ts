import type { AnatomiaRef, GraphNodeType, GraphRelation } from '../../db/schema/code-graph.ts';

export interface GraphTarget {
  kind: 'domain' | 'layout' | 'transition';
  name: string;
}

export interface AnatomiaGraph {
  nodes: Array<{ id: string; name: string; kind: string; path: string }>;
  edges: Array<{ from: string; to: string; kind: string }>;
}

export interface SelectedGraph {
  nodes: Array<{ key: string; label: string; type: GraphNodeType; anatomia_ref: AnatomiaRef }>;
  edges: Array<{ from: string; to: string; relation: GraphRelation }>;
  summary: string;
}
