import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { verifyDompurifyLockUpdate } from './verify-dompurify-lock.ts';

const after = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'));
const before = structuredClone(after);
Object.assign(before.packages['node_modules/dompurify'], {
  version: '3.4.15',
  resolved: 'https://registry.npmjs.org/dompurify/-/dompurify-3.4.15.tgz',
  integrity: 'sha512-EUBjM+B+lkDE41iE82DDSCfkoPGfXx8IxFxPMjNzm/Uk4xDet77rTN9wqlxlVg71kK7XGuUMv6wUxJUwwv+Xyw==',
});

test('only the approved DOMPurify lock metadata changes', () => {
  assert.equal(verifyDompurifyLockUpdate(before, after), true);
  assert.equal(before.packages['node_modules/dompurify'].version, '3.4.15');
  assert.equal(after.packages['node_modules/mermaid'].dependencies.dompurify, '^3.3.3');
});

test('rejects vulnerable versions and unrelated dependency changes', () => {
  assert.equal(verifyDompurifyLockUpdate(before, before), false);
  const unrelated = structuredClone(after);
  unrelated.packages['node_modules/mermaid'].version = '99.0.0';
  assert.equal(verifyDompurifyLockUpdate(before, unrelated), false);
  const badIntegrity = structuredClone(after);
  badIntegrity.packages['node_modules/dompurify'].integrity = 'invalid';
  assert.equal(verifyDompurifyLockUpdate(before, badIntegrity), false);
});
