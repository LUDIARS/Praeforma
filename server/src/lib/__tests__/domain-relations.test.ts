import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domainRelations, reaches, type RelationDomain } from '../../../../shared/domain-relations.ts';

test('PF-DR diagram merges legacy and multiple memberships without duplicate edges', () => {
  const domains: RelationDomain[] = [
    { id: 'a', parentId: null, definitionKind: 'core' },
    { id: 'b', parentId: null, definitionKind: 'core' },
    { id: 'child', parentId: 'a', definitionKind: 'business' },
    { id: 'nested', parentId: 'child', definitionKind: 'core' },
  ];
  const edges = domainRelations(domains, [
    { coreId: 'a', businessId: 'child' }, { coreId: 'b', businessId: 'child' },
    { coreId: 'missing', businessId: 'child' },
  ]);
  assert.equal(edges.length, 3);
  assert.equal(edges.filter(edge => edge.to === 'child').length, 2);
  assert.equal(edges.find(edge => edge.to === 'nested')?.kind, 'parent');
  assert.equal(reaches(edges, 'b', 'nested'), true);
  assert.equal(reaches(edges, 'child', 'b'), false);
  assert.equal(reaches([...edges, { from: 'nested', to: 'b', kind: 'parent' }], 'child', 'missing'), false);
});

test('PF-DR batch edges are considered together when detecting a cycle', () => {
  // core1 -> b1 と core2 -> b2 が既にあり、 b1 の下に core2、 b2 の下に core1 がある形。
  // 片方ずつでは循環しないが、 同じ一括追加で両方入れると循環する。
  const domains: RelationDomain[] = [
    { id: 'core1', parentId: null, definitionKind: 'core' },
    { id: 'core2', parentId: 'b1', definitionKind: 'core' },
    { id: 'b1', parentId: null, definitionKind: 'business' },
    { id: 'b2', parentId: null, definitionKind: 'business' },
  ];
  const stored = domainRelations(domains, []);
  assert.equal(reaches(stored, 'b1', 'core1'), false);
  const withBatch = domainRelations(domains, [{ coreId: 'core1', businessId: 'b1' }]);
  assert.equal(reaches(withBatch, 'b1', 'core1'), false);
  assert.equal(reaches(withBatch, 'core1', 'core2'), true);
});
