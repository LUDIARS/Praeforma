import { WEB_MOBILE_MAX_WIDTH, type WebNode, type WebScene, type WebStyle } from './web-scene.ts';

export type WebPlacementDevice = Exclude<WebStyle['device'], 'all'>;
export interface WebOffset { x: number; y: number }
export type WebPlacementError = 'unknown_node' | 'text_node' | 'unreadable_offset' | 'too_many_classes' | 'too_many_rules';
export type WebPlacementResult =
  | { ok: true; scene: WebScene; changed: boolean; offset: WebOffset }
  | { ok: false; reason: WebPlacementError };

export const PLACEMENT_CLASS_PREFIX = 'pf-pos-';
// Mirror the schema caps so a move reports a precise reason instead of failing validation.
const MAX_NODE_CLASSES = 30;
const MAX_STYLE_RULES = 200;
const MAX_READABLE_ID = 80;
const OFFSET_PATTERN = /^(-?\d+(?:\.\d+)?)px(?:\s+(-?\d+(?:\.\d+)?)px)?$/;

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(36);
}

/**
 * The class that carries one node's moved position (PF-WEB-7). It is derived from the node id so the
 * PC and mobile rules of the same node share a name; ids that are not valid class text get a hash suffix.
 */
export function placementClassName(nodeId: string): string {
  const readable = nodeId.replace(/[^A-Za-z0-9_-]/g, '-');
  return readable === nodeId && readable.length <= MAX_READABLE_ID
    ? `${PLACEMENT_CLASS_PREFIX}${readable}`
    : `${PLACEMENT_CLASS_PREFIX}${readable.slice(0, MAX_READABLE_ID)}-${fnv1a(nodeId)}`;
}

/** The device rule that applies inside a preview of this width, matching webCss media queries. */
export function deviceForViewport(width: number): WebPlacementDevice {
  return width <= WEB_MOBILE_MAX_WIDTH ? 'mobile' : 'desktop';
}

/** The saved offset of a node on one device; null when the rule holds a value this editor cannot add to. */
export function readOffset(styles: readonly WebStyle[], nodeId: string, device: WebPlacementDevice): WebOffset | null {
  const className = placementClassName(nodeId);
  const value = styles.find(style => style.className === className && style.device === device)?.declarations.translate;
  if (value === undefined) return { x: 0, y: 0 };
  const match = OFFSET_PATTERN.exec(value.trim());
  return match ? { x: Number(match[1]), y: Number(match[2] ?? 0) } : null;
}

function findNode(scene: WebScene, frameId: string, nodeId: string): WebNode | undefined {
  return scene.variants.find(variant => variant.frameId === frameId)?.nodes.find(node => node.id === nodeId);
}

function withNodeClasses(scene: WebScene, frameId: string, nodeId: string, classes: string[]): WebScene {
  return { ...scene, variants: scene.variants.map(variant => variant.frameId !== frameId ? variant
    : { ...variant, nodes: variant.nodes.map(node => node.id === nodeId ? { ...node, classes } : node) }) };
}

/** Store `offset` as the node's `translate` for one device; (0, 0) removes the declaration and an emptied rule. */
export function writeOffset(scene: WebScene, frameId: string, nodeId: string, device: WebPlacementDevice, offset: WebOffset): WebPlacementResult {
  const node = findNode(scene, frameId, nodeId);
  if (!node) return { ok: false, reason: 'unknown_node' };
  if (node.tag === 'text') return { ok: false, reason: 'text_node' };
  const className = placementClassName(nodeId);
  const next = { x: Math.round(offset.x), y: Math.round(offset.y) };
  const translate = next.x === 0 && next.y === 0 ? undefined : `${next.x}px ${next.y}px`;
  const index = scene.styles.findIndex(style => style.className === className && style.device === device);
  const existing = index < 0 ? undefined : scene.styles[index];
  if (existing?.declarations.translate === translate) return { ok: true, scene, changed: false, offset: next };
  // Other declarations a user added to the placement rule are kept; only the offset is ours.
  const declarations: WebStyle['declarations'] = { ...existing?.declarations };
  if (translate === undefined) delete declarations.translate; else declarations.translate = translate;
  const rule: WebStyle = { className, device, declarations };
  const styles = Object.keys(declarations).length === 0 ? scene.styles.filter((_, i) => i !== index)
    : index < 0 ? [...scene.styles, rule] : scene.styles.map((style, i) => i === index ? rule : style);
  if (styles.length > MAX_STYLE_RULES) return { ok: false, reason: 'too_many_rules' };
  // The node keeps the class while any device still has a rule for it.
  const isReferenced = styles.some(style => style.className === className);
  const hasClass = node.classes.includes(className);
  if (isReferenced && !hasClass && node.classes.length >= MAX_NODE_CLASSES) return { ok: false, reason: 'too_many_classes' };
  const classes = isReferenced === hasClass ? node.classes : isReferenced ? [...node.classes, className] : node.classes.filter(name => name !== className);
  const moved: WebScene = { ...scene, styles };
  return { ok: true, scene: classes === node.classes ? moved : withNodeClasses(moved, frameId, nodeId, classes), changed: true, offset: next };
}

/** Group move (PF-WEB-7): shift the node, and with it every descendant, by `delta` on one device. */
export function offsetNode(scene: WebScene, frameId: string, nodeId: string, device: WebPlacementDevice, delta: WebOffset): WebPlacementResult {
  const current = readOffset(scene.styles, nodeId, device);
  if (!current) return { ok: false, reason: 'unreadable_offset' };
  return writeOffset(scene, frameId, nodeId, device, { x: current.x + delta.x, y: current.y + delta.y });
}
