import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneSaveSchema } from '../../../../shared/scene-editor.ts';

const frame = { id: 'pc', name: 'Screen', description: '', states: [], x: 0, y: 0, width: 1440, height: 900, viewport: { width: 1440, height: 900 } };

test('PF-SCENE-7 accepts legacy frames and preserves independent device definitions and sources', () => {
  const canvas = { expected_revision: 0, frames: [frame], elements: [], transitions: [] };
  assert.equal(sceneSaveSchema.safeParse({ canvas, sources: [] }).success, true);
  const input = { canvas: { ...canvas, frames: [{ ...frame, device: 'desktop' }, { ...frame, id: 'phone', device: 'mobile', width: 390, height: 844, viewport: { width: 390, height: 844 } }] }, sources: [{ id: 'phone-reference', frameId: 'phone', fingerprint: null, image: null, runtime: null, notes: ['Phone layout'] }] };
  const parsed = sceneSaveSchema.parse(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(parsed, input);
  assert.equal(sceneSaveSchema.safeParse({ ...input, canvas: { ...canvas, frames: [{ ...frame, device: 'invalid' }] } }).success, false);
});
