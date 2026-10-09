import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domainLinkTodos, type TodoDomain } from '../../../../shared/domain-link-todos.ts';

const domain = (id: string, definitionKind: TodoDomain['definitionKind'], parentId: string | null = null): TodoDomain =>
  ({ id, name: id, definitionKind, parentId });

test('a project without core domains asks for a core first', () => {
  const items = domainLinkTodos('p1', [domain('b1', 'business')], []);
  assert.deepEqual(items.map(item => item.kind), ['missing-core', 'unlinked-business']);
  assert.equal(items[0]?.domainId, null);
  assert.equal(items[0]?.ref, 'pf:p1:missing-core:p1');
});

test('an empty project has one todo, not one per code symbol', () => {
  assert.deepEqual(domainLinkTodos('p1', [], []).map(item => item.kind), ['missing-core']);
});

test('memberships and legacy core parents both link business domains', () => {
  const domains = [domain('c1', 'core'), domain('c2', 'core'), domain('b1', 'business'), domain('b2', 'business', 'c2'), domain('b3', 'business')];
  const items = domainLinkTodos('p1', domains, [{ coreId: 'c1', businessId: 'b1' }]);
  assert.deepEqual(items.map(item => `${item.kind}:${item.domainId}`), ['unlinked-business:b3']);
});

test('cores without business members and unclassified domains are reported', () => {
  const items = domainLinkTodos('p1', [domain('c1', 'core'), domain('x', null), domain('c2', 'core'), domain('b1', 'business')],
    [{ coreId: 'c2', businessId: 'b1' }]);
  assert.deepEqual(items.map(item => `${item.kind}:${item.domainId}`), ['unclassified-domain:x', 'empty-core:c1']);
});

test('memberships pointing at other kinds do not count as links', () => {
  const items = domainLinkTodos('p1', [domain('c1', 'core'), domain('b1', 'business')], [{ coreId: 'b1', businessId: 'c1' }]);
  assert.deepEqual(items.map(item => item.kind).sort(), ['empty-core', 'unlinked-business']);
});
