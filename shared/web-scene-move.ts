import type { WebScene } from './web-scene.ts';
import { offsetNode, writeOffset, type WebOffset, type WebPlacementDevice, type WebPlacementError } from './web-scene-placement.ts';
import { reparentNode, type WebTreeMoveError, type WebTreeMoveKind } from './web-scene-tree.ts';

/** How the preview drag moves the grabbed element (PF-WEB-7 / PF-WEB-8). */
export type WebMoveMode = 'group' | 'individual';
export type WebMoveKind = 'group' | WebTreeMoveKind;
export type WebMoveError = WebPlacementError | WebTreeMoveError;
export type WebMoveResult =
  | { ok: true; scene: WebScene; changed: boolean; kind: WebMoveKind }
  | { ok: false; reason: WebMoveError };

/** Group move: the element keeps its place in the DOM and is shifted, with its descendants, by CSS. */
export function groupMove(scene: WebScene, frameId: string, nodeId: string, device: WebPlacementDevice, delta: WebOffset): WebMoveResult {
  const result = offsetNode(scene, frameId, nodeId, device, delta);
  return result.ok ? { ok: true, scene: result.scene, changed: result.changed, kind: 'group' } : result;
}

/** Group placement entered as numbers: the same rule a drag writes, set to an absolute offset. */
export function placeGroup(scene: WebScene, frameId: string, nodeId: string, device: WebPlacementDevice, offset: WebOffset): WebMoveResult {
  const result = writeOffset(scene, frameId, nodeId, device, offset);
  return result.ok ? { ok: true, scene: result.scene, changed: result.changed, kind: 'group' } : result;
}

/**
 * Individual move: the element leaves its parent for `parentId` (detach toward an ancestor or the root,
 * merge into another element, or reorder in place). A previous offset on this device would displace it
 * inside the new parent, so it is reset in the same edit (one undo step).
 */
export function individualMove(scene: WebScene, frameId: string, nodeId: string, parentId: string | null, beforeId: string | null, device: WebPlacementDevice): WebMoveResult {
  const variant = scene.variants.find(item => item.frameId === frameId);
  if (!variant) return { ok: false, reason: 'unknown_node' };
  const tree = reparentNode(variant.nodes, nodeId, parentId, beforeId);
  if (!tree.ok) return tree;
  if (!tree.changed) return { ok: true, scene, changed: false, kind: tree.kind };
  const moved: WebScene = { ...scene, variants: scene.variants.map(item => item.frameId === frameId ? { ...item, nodes: tree.nodes } : item) };
  const node = tree.nodes.find(item => item.id === nodeId);
  if (node?.tag === 'text') return { ok: true, scene: moved, changed: true, kind: tree.kind };
  const reset = writeOffset(moved, frameId, nodeId, device, { x: 0, y: 0 });
  return reset.ok ? { ok: true, scene: reset.scene, changed: true, kind: tree.kind } : reset;
}
