import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classNameSchema, webSceneSchema, type WebNode, type WebScene } from '../../../../shared/web-scene.ts';
import { webCss, webMarkup } from '../../../../shared/web-scene-export.ts';
import { deviceForViewport, placementClassName, readOffset } from '../../../../shared/web-scene-placement.ts';
import { groupMove, individualMove, placeGroup } from '../../../../shared/web-scene-move.ts';
import { reparentNode, subtreeIds } from '../../../../shared/web-scene-tree.ts';
import { dropParent, grabTarget, insertionPoint } from '../../../../shared/web-scene-pointer.ts';

// A fictional app shell: a header holding a tab bar, and a main area with a side menu.
const node = (id: string, parentId: string | null, tag: WebNode['tag'] = 'div', text = ''): WebNode => ({ id, parentId, tag, text, classes: [], attributes: {} });
const nodes: WebNode[] = [
  node('header', null, 'header'),
  node('tabs', 'header', 'nav'),
  node('tab-a', 'tabs', 'button', 'Home'),
  node('tab-b', 'tabs', 'button', 'Search'),
  node('main', null, 'main'),
  node('menu', 'main', 'ul'),
  node('item', 'menu', 'li'),
  node('item-label', 'item', 'text', 'Settings'),
  node('field', 'main', 'input'),
];
const scene: WebScene = { version: 1, variants: [{ frameId: 'phone', nodes }, { frameId: 'pc', nodes }], styles: [{ className: 'tab', device: 'all', declarations: { padding: '8px' } }] };
const variantNodes = (value: WebScene, frameId = 'phone'): WebNode[] => value.variants.find(variant => variant.frameId === frameId)?.nodes ?? [];
const childrenOf = (list: readonly WebNode[], parentId: string | null): string[] => list.filter(item => item.parentId === parentId).map(item => item.id);

test('PF-WEB-7: placement classes are valid, stable per node and split by the preview media query', () => {
  assert.equal(placementClassName('tab-a'), 'pf-pos-tab-a');
  assert.equal(placementClassName('tab-a'), placementClassName('tab-a'));
  for (const id of ['a.b', 'a b', 'x'.repeat(120), '日本語']) assert.equal(classNameSchema.safeParse(placementClassName(id)).success, true, id);
  assert.notEqual(placementClassName('a.b'), placementClassName('a b'));
  assert.equal(deviceForViewport(390), 'mobile');
  assert.equal(deviceForViewport(767), 'mobile');
  assert.equal(deviceForViewport(768), 'desktop');
  assert.equal(deviceForViewport(1440), 'desktop');
});

test('PF-WEB-7: group move stores a per-device translate rule that exports as CSS and HTML', () => {
  const moved = groupMove(scene, 'phone', 'tabs', 'mobile', { x: 12.4, y: -30.6 });
  assert.ok(moved.ok && moved.changed && moved.kind === 'group');
  assert.equal(webSceneSchema.safeParse(moved.scene).success, true);
  assert.deepEqual(moved.scene.styles.at(-1), { className: 'pf-pos-tabs', device: 'mobile', declarations: { translate: '12px -31px' } });
  assert.deepEqual(variantNodes(moved.scene).find(item => item.id === 'tabs')?.classes, ['pf-pos-tabs']);
  // Descendants move with the group because only the group root carries the rule.
  assert.deepEqual(variantNodes(moved.scene).find(item => item.id === 'tab-a')?.classes, []);
  assert.ok(webMarkup(moved.scene, 'phone').includes('<nav class="pf-pos-tabs">'));
  const css = webCss(moved.scene);
  assert.ok(css.indexOf('padding: 8px') < css.indexOf('@media (max-width: 767px) {\n.pf-pos-tabs {\n  translate: 12px -31px;'));
  // The other frame keeps its own DOM; the PC rule is independent of the phone rule.
  assert.deepEqual(variantNodes(moved.scene, 'pc').find(item => item.id === 'tabs')?.classes, []);
  const again = groupMove(moved.scene, 'phone', 'tabs', 'mobile', { x: 8, y: 1 });
  assert.ok(again.ok);
  assert.deepEqual(readOffset(again.scene.styles, 'tabs', 'mobile'), { x: 20, y: -30 });
  const desktop = groupMove(again.scene, 'pc', 'tabs', 'desktop', { x: 100, y: 0 });
  assert.ok(desktop.ok);
  assert.deepEqual(readOffset(desktop.scene.styles, 'tabs', 'desktop'), { x: 100, y: 0 });
  assert.deepEqual(readOffset(desktop.scene.styles, 'tabs', 'mobile'), { x: 20, y: -30 });
});

test('PF-WEB-7: returning to the origin removes the rule and class; invalid targets are refused', () => {
  const moved = groupMove(scene, 'phone', 'menu', 'mobile', { x: 5, y: 5 });
  assert.ok(moved.ok);
  const back = placeGroup(moved.scene, 'phone', 'menu', 'mobile', { x: 0, y: 0 });
  assert.ok(back.ok && back.changed);
  assert.deepEqual(back.scene.styles, scene.styles);
  assert.deepEqual(variantNodes(back.scene).find(item => item.id === 'menu')?.classes, []);
  const unchanged = groupMove(scene, 'phone', 'menu', 'mobile', { x: 0.2, y: -0.3 });
  assert.ok(unchanged.ok && !unchanged.changed);
  assert.deepEqual(groupMove(scene, 'phone', 'item-label', 'mobile', { x: 1, y: 1 }), { ok: false, reason: 'text_node' });
  assert.deepEqual(groupMove(scene, 'phone', 'absent', 'mobile', { x: 1, y: 1 }), { ok: false, reason: 'unknown_node' });
  const percent: WebScene = { ...scene, styles: [...scene.styles, { className: 'pf-pos-menu', device: 'mobile', declarations: { translate: '10%' } }] };
  assert.deepEqual(groupMove(percent, 'phone', 'menu', 'mobile', { x: 1, y: 1 }), { ok: false, reason: 'unreadable_offset' });
  const crowded: WebScene = { ...scene, variants: [{ frameId: 'phone', nodes: nodes.map(item => item.id === 'menu' ? { ...item, classes: Array.from({ length: 30 }, (_, i) => `c${i}`) } : item) }] };
  assert.deepEqual(groupMove(crowded, 'phone', 'menu', 'mobile', { x: 1, y: 1 }), { ok: false, reason: 'too_many_classes' });
});

test('PF-WEB-7: translate is an allowed property and unsafe values stay rejected', () => {
  assert.equal(webSceneSchema.safeParse({ ...scene, styles: [{ className: 'x', device: 'all', declarations: { translate: '4px -2px' } }] }).success, true);
  for (const value of ['url(https://example.com)', '1px; color: red', '</style>']) {
    assert.equal(webSceneSchema.safeParse({ ...scene, styles: [{ className: 'x', device: 'all', declarations: { translate: value } }] }).success, false);
  }
});

test('PF-WEB-8: individual move detaches, merges and reorders by changing parentId and sibling order', () => {
  const detached = individualMove(scene, 'phone', 'tab-b', null, 'main', 'mobile');
  assert.ok(detached.ok && detached.kind === 'detach');
  assert.deepEqual(childrenOf(variantNodes(detached.scene), null), ['header', 'tab-b', 'main']);
  assert.deepEqual(childrenOf(variantNodes(detached.scene), 'tabs'), ['tab-a']);
  assert.ok(webMarkup(detached.scene, 'phone').indexOf('Search') < webMarkup(detached.scene, 'phone').indexOf('<main>'));
  const toAncestor = individualMove(scene, 'phone', 'tab-b', 'header', null, 'mobile');
  assert.ok(toAncestor.ok && toAncestor.kind === 'detach');
  const merged = individualMove(scene, 'phone', 'tab-b', 'menu', 'item', 'mobile');
  assert.ok(merged.ok && merged.kind === 'merge');
  assert.deepEqual(childrenOf(variantNodes(merged.scene), 'menu'), ['tab-b', 'item']);
  const reordered = individualMove(scene, 'phone', 'tab-b', 'tabs', 'tab-a', 'mobile');
  assert.ok(reordered.ok && reordered.kind === 'reorder' && reordered.changed);
  assert.deepEqual(childrenOf(variantNodes(reordered.scene), 'tabs'), ['tab-b', 'tab-a']);
  const same = individualMove(scene, 'phone', 'tab-b', 'tabs', null, 'mobile');
  assert.ok(same.ok && !same.changed);
  // The whole group moves as a subtree when its root is moved individually.
  const menuMoved = individualMove(scene, 'phone', 'menu', 'header', null, 'mobile');
  assert.ok(menuMoved.ok);
  assert.deepEqual(childrenOf(variantNodes(menuMoved.scene), 'menu'), ['item']);
  assert.equal(webSceneSchema.safeParse(menuMoved.scene).success, true);
});

test('PF-WEB-8: individual move resets the offset on this device and keeps the save validation', () => {
  const offset = groupMove(scene, 'phone', 'tab-b', 'mobile', { x: 40, y: 0 });
  assert.ok(offset.ok);
  const moved = individualMove(offset.scene, 'phone', 'tab-b', 'menu', null, 'mobile');
  assert.ok(moved.ok);
  assert.deepEqual(readOffset(moved.scene.styles, 'tab-b', 'mobile'), { x: 0, y: 0 });
  assert.equal(moved.scene.styles.some(style => style.className === 'pf-pos-tab-b'), false);
  assert.deepEqual(individualMove(scene, 'phone', 'tabs', 'tab-a', null, 'mobile'), { ok: false, reason: 'cycle' });
  assert.deepEqual(individualMove(scene, 'phone', 'tab-a', 'field', null, 'mobile'), { ok: false, reason: 'childless_parent' });
  assert.deepEqual(individualMove(scene, 'phone', 'tab-a', 'item-label', null, 'mobile'), { ok: false, reason: 'childless_parent' });
  assert.deepEqual(individualMove(scene, 'phone', 'tab-a', 'absent', null, 'mobile'), { ok: false, reason: 'unknown_parent' });
  assert.deepEqual(individualMove(scene, 'phone', 'tab-a', 'menu', 'tab-b', 'mobile'), { ok: false, reason: 'unknown_sibling' });
});

test('PF-WEB-8: the depth limit of 32 ancestors matches the save schema', () => {
  const chain = Array.from({ length: 33 }, (_, i) => node(`d${i}`, i === 0 ? null : `d${i - 1}`));
  const deep = [...chain, node('box', null), node('leaf', 'box')];
  assert.equal(webSceneSchema.safeParse({ version: 1, variants: [{ frameId: 'f', nodes: deep }], styles: [] }).success, true);
  assert.equal(reparentNode(deep, 'leaf', 'd32', null).ok, false);
  assert.deepEqual(reparentNode(deep, 'box', 'd31', null), { ok: false, reason: 'too_deep' });
  const fits = reparentNode(deep, 'leaf', 'd31', null);
  assert.ok(fits.ok);
  assert.equal(webSceneSchema.safeParse({ version: 1, variants: [{ frameId: 'f', nodes: fits.nodes }], styles: [] }).success, true);
});

test('PF-WEB-8: pointer resolution picks the grabbed group, the drop parent and the sibling position', () => {
  assert.deepEqual([...subtreeIds(nodes, 'tabs')].sort(), ['tab-a', 'tab-b', 'tabs']);
  assert.equal(grabTarget(nodes, 'tabs', 'tab-a'), 'tabs');
  assert.equal(grabTarget(nodes, 'menu', 'tab-a'), 'tab-a');
  assert.equal(grabTarget(nodes, null, 'item-label'), 'item');
  assert.equal(grabTarget(nodes, 'item-label', 'item-label'), 'item-label');
  assert.equal(dropParent(nodes, 'tab-b', 'tab-b'), 'tabs');
  assert.equal(dropParent(nodes, 'tabs', 'tab-a'), 'header');
  assert.equal(dropParent(nodes, 'tab-a', 'field'), 'main');
  assert.equal(dropParent(nodes, 'tab-a', 'item-label'), 'item');
  assert.equal(dropParent(nodes, 'header', 'tab-a'), null);
  assert.equal(dropParent(nodes, 'tab-a', null), null);
  const column = [{ id: 'a', rect: { left: 0, top: 0, width: 300, height: 40 } }, { id: 'b', rect: { left: 0, top: 40, width: 300, height: 40 } }];
  assert.deepEqual(insertionPoint(column, { x: 250, y: 45 }), { beforeId: 'b', marker: { rect: column[1]!.rect, side: 'top' } });
  assert.deepEqual(insertionPoint(column, { x: 20, y: 75 }), { beforeId: null, marker: { rect: column[1]!.rect, side: 'bottom' } });
  const row = [{ id: 'a', rect: { left: 0, top: 0, width: 60, height: 40 } }, { id: 'b', rect: { left: 60, top: 0, width: 60, height: 40 } }];
  assert.equal(insertionPoint(row, { x: 50, y: 20 }).beforeId, 'b');
  assert.equal(insertionPoint(row, { x: 65, y: 20 }).beforeId, 'b');
  assert.equal(insertionPoint(row, { x: 5, y: 20 }).beforeId, 'a');
  assert.deepEqual(insertionPoint([], { x: 0, y: 0 }), { beforeId: null, marker: null });
});
