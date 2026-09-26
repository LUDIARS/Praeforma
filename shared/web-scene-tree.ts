import { childlessWebTags, MAX_WEB_DOM_DEPTH, type WebNode } from './web-scene.ts';

/** Why a structural move was refused; the editor maps each code to a message. */
export type WebTreeMoveError = 'unknown_node' | 'unknown_parent' | 'unknown_sibling' | 'cycle' | 'childless_parent' | 'too_deep';
export type WebTreeMoveKind = 'reorder' | 'detach' | 'merge';
export type WebTreeMoveResult =
  | { ok: true; nodes: WebNode[]; changed: boolean; kind: WebTreeMoveKind }
  | { ok: false; reason: WebTreeMoveError };

/** The node and every descendant (PF-WEB-7: a group moves with its subtree). */
export function subtreeIds(nodes: readonly WebNode[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of nodes) {
      if (node.parentId !== null && ids.has(node.parentId) && !ids.has(node.id)) { ids.add(node.id); grew = true; }
    }
  }
  return ids;
}

export function canOwnChildren(node: WebNode): boolean {
  return !childlessWebTags.includes(node.tag);
}

/** Nodes from `id` up to its root, inclusive (0 for the root position). Capped so a malformed tree cannot loop. */
function chainLength(byId: ReadonlyMap<string, WebNode>, id: string | null): number {
  let count = 0;
  for (let current = id; current !== null && count <= MAX_WEB_DOM_DEPTH; count++) current = byId.get(current)?.parentId ?? null;
  return count;
}

/** Leaving toward an ancestor (or the root) separates a node from its group; any other parent merges it elsewhere. */
function moveKind(byId: ReadonlyMap<string, WebNode>, from: string | null, to: string | null): WebTreeMoveKind {
  if (from === to) return 'reorder';
  for (let current = from; current !== null; current = byId.get(current)?.parentId ?? null) {
    if (byId.get(current)?.parentId === to) return 'detach';
  }
  return 'merge';
}

/**
 * Individual move (PF-WEB-8): re-parent `nodeId` with its subtree under `parentId` (null = root),
 * placed before sibling `beforeId` (null = last). Sibling order follows array order, as in webMarkup.
 */
export function reparentNode(nodes: readonly WebNode[], nodeId: string, parentId: string | null, beforeId: string | null): WebTreeMoveResult {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const node = byId.get(nodeId);
  if (!node) return { ok: false, reason: 'unknown_node' };
  const subtree = subtreeIds(nodes, nodeId);
  if (parentId !== null) {
    const parent = byId.get(parentId);
    if (!parent) return { ok: false, reason: 'unknown_parent' };
    if (subtree.has(parentId)) return { ok: false, reason: 'cycle' };
    if (!canOwnChildren(parent)) return { ok: false, reason: 'childless_parent' };
  }
  if (beforeId !== null && (beforeId === nodeId || byId.get(beforeId)?.parentId !== parentId)) return { ok: false, reason: 'unknown_sibling' };
  // After the move the node's ancestors are the new parent's chain; descendants keep their offset below it.
  const subtreeHeight = Math.max(...[...subtree].map(id => chainLength(byId, id) - chainLength(byId, nodeId)));
  if (chainLength(byId, parentId) + subtreeHeight > MAX_WEB_DOM_DEPTH) return { ok: false, reason: 'too_deep' };
  const moved: WebNode = { ...node, parentId };
  const rest = nodes.filter(item => item.id !== nodeId);
  const at = beforeId === null ? rest.length : rest.findIndex(item => item.id === beforeId);
  const next = [...rest.slice(0, at), moved, ...rest.slice(at)];
  const siblingOrder = (list: readonly WebNode[]): string => list.filter(item => item.parentId === parentId).map(item => item.id).join('\n');
  const changed = node.parentId !== parentId || siblingOrder(nodes) !== siblingOrder(next);
  return { ok: true, nodes: changed ? next : [...nodes], changed, kind: moveKind(byId, node.parentId, parentId) };
}
