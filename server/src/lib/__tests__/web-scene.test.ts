import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webSceneSchema, type WebScene } from '../../../../shared/web-scene.ts';
import { webCss, webMarkup, webPreview, sourceDiff } from '../../../../shared/web-scene-export.ts';
import { sceneSaveSchema } from '../../../../shared/scene-editor.ts';
import { importClassRules } from '../../../../shared/web-class-import.ts';

const scene: WebScene = { version: 1, variants: [{ frameId: 'pc', nodes: [
  { id: 'root', parentId: null, tag: 'div', text: '', classes: ['layout'], attributes: {} },
  { id: 'button', parentId: 'root', tag: 'button', text: '<script>alert(1)</script>', classes: ['button'], attributes: { title: '"quoted"' } },
] }], styles: [{ className: 'button', device: 'mobile', declarations: { width: '100%' } }, { className: 'button', device: 'all', declarations: { width: '120px', color: 'white' } }] };

test('PF-WEB-1: invalid trees, executable markup and resource CSS are rejected', () => {
  assert.equal(webSceneSchema.safeParse(scene).success, true);
  for (const patch of [{ parentId: 'button' }, { parentId: 'absent' }, { tag: 'script' }, { attributes: { onclick: 'alert(1)' } }]) {
    const nodes = scene.variants[0]!.nodes.map(node => node.id === 'button' ? { ...node, ...patch } : node);
    assert.equal(webSceneSchema.safeParse({ ...scene, variants: [{ frameId: 'pc', nodes }] }).success, false);
  }
  for (const value of ['url(https://example.com)', 'red; background: blue', '</style><script>', 'u\\72l(test)']) {
    assert.equal(webSceneSchema.safeParse({ ...scene, styles: [{ className: 'button', device: 'all', declarations: { color: value } }] }).success, false);
  }
  assert.equal(webSceneSchema.safeParse({ ...scene, variants: [...scene.variants, ...scene.variants] }).success, false);
});

test('PF-WEB-2: exported markup escapes text and preview prevents active content', () => {
  const html = webMarkup(scene, 'pc');
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&quot;quoted&quot;'));
  assert.ok(!html.includes('data-pf-node')); assert.ok(webPreview(scene, 'pc').includes('data-pf-node="button"'));
  assert.ok(webPreview(scene, 'pc').includes("default-src 'none'"));
  const css = webCss(scene); assert.ok(css.indexOf('width: 120px') < css.indexOf('@media (max-width: 767px)'));
  assert.equal(sourceDiff('same', 'same', 'scene.html'), '');
  assert.ok(sourceDiff('before', 'after', 'scene.html').includes('-before\n+after'));
});

test('PF-WEB-3: class imports and frame-scoped web documents survive the scene save contract', () => {
  assert.deepEqual(importClassRules('.button { padding: 12px; color: red; }', 'desktop'), [{ className: 'button', device: 'desktop', declarations: { padding: '12px', color: 'red' } }]);
  assert.throws(() => importClassRules('@import "https://example.com";', 'all'));
  assert.throws(() => importClassRules('.button { background-color: url(test); }', 'all'));
  const canvas = { expected_revision: 0, frames: [{ id: 'pc', name: 'PC', device: 'desktop', description: '', states: [], x: 0, y: 0, width: 1440, height: 900, viewport: { width: 1440, height: 900 } }], elements: [], transitions: [] };
  assert.deepEqual(sceneSaveSchema.parse({ canvas, sources: [], web: scene }).web, scene);
  assert.equal(sceneSaveSchema.safeParse({ canvas: { ...canvas, frames: [] }, sources: [], web: scene }).success, false);
});
