import type { WebNode } from './web-scene.ts';
import { canOwnChildren, subtreeIds } from './web-scene-tree.ts';

export interface WebPoint { x: number; y: number }
export interface WebRect { left: number; top: number; width: number; height: number }
export interface WebSiblingBox { id: string; rect: WebRect }
/** Where a drop lands among siblings; `marker` is the edge to highlight (null when there are no siblings). */
export interface WebInsertion { beforeId: string | null; marker: { rect: WebRect; side: 'top' | 'bottom' | 'left' | 'right' } | null }

/**
 * The node a press starts dragging. Inside the selection the whole selection moves (a tab bar or menu as
 * one group); elsewhere the pressed element moves, and a text run stands for the element that holds it.
 */
export function grabTarget(nodes: readonly WebNode[], selectedId: string | null, hitId: string): string {
  if (selectedId && subtreeIds(nodes, selectedId).has(hitId)) return selectedId;
  const hit = nodes.find(node => node.id === hitId);
  return hit?.tag === 'text' && hit.parentId !== null ? hit.parentId : hitId;
}

/**
 * The parent an individual move drops into: the nearest element at or above the hit that may own children
 * and is outside the moving subtree. null means the root of the screen.
 */
export function dropParent(nodes: readonly WebNode[], movingId: string, hitId: string | null): string | null {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const moving = subtreeIds(nodes, movingId);
  for (let current = hitId, steps = 0; current !== null && steps <= nodes.length; steps++) {
    const node = byId.get(current);
    if (!node) return null;
    if (!moving.has(node.id) && canOwnChildren(node)) return node.id;
    current = node.parentId;
  }
  return null;
}

function distanceToRect(point: WebPoint, rect: WebRect): number {
  const dx = Math.max(rect.left - point.x, 0, point.x - (rect.left + rect.width));
  const dy = Math.max(rect.top - point.y, 0, point.y - (rect.top + rect.height));
  return Math.hypot(dx, dy);
}

/** Siblings flow in a row when a later one sits beside an earlier one on the same line (tabs, inline menus). */
function isRow(siblings: readonly WebSiblingBox[]): boolean {
  return siblings.some((sibling, index) => {
    const previous = siblings[index - 1]?.rect;
    if (!previous) return false;
    const { rect } = sibling;
    const overlap = Math.min(previous.top + previous.height, rect.top + rect.height) - Math.max(previous.top, rect.top);
    return overlap > Math.min(previous.height, rect.height) / 2 && rect.left >= previous.left + previous.width / 2;
  });
}

/**
 * Sibling position for a drop at `point`. The nearest sibling decides; the pointer's side of its center
 * along the siblings' flow (row or column) gives before/after.
 */
export function insertionPoint(siblings: readonly WebSiblingBox[], point: WebPoint): WebInsertion {
  let nearest = -1, best = Infinity;
  siblings.forEach((sibling, index) => {
    const distance = distanceToRect(point, sibling.rect);
    if (distance < best) { best = distance; nearest = index; }
  });
  const target = siblings[nearest];
  if (!target) return { beforeId: null, marker: null };
  const { rect } = target;
  const isHorizontal = isRow(siblings);
  const isBefore = isHorizontal ? point.x < rect.left + rect.width / 2 : point.y < rect.top + rect.height / 2;
  const side = isHorizontal ? (isBefore ? 'left' : 'right') : (isBefore ? 'top' : 'bottom');
  return { beforeId: isBefore ? target.id : siblings[nearest + 1]?.id ?? null, marker: { rect, side } };
}
