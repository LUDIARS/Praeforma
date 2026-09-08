export interface DomainMembership { coreId: string; businessId: string }
export interface RelationDomain { id: string; parentId: string | null; definitionKind: 'core' | 'business' | null }
export interface DomainRelation { from: string; to: string; kind: 'membership' | 'parent' }

/** Keep legacy parent links visible alongside many-to-many memberships. */
export function domainRelations(domains: RelationDomain[], memberships: DomainMembership[]): DomainRelation[] {
  const ids = new Set(domains.map(domain => domain.id));
  const relations = new Map<string, DomainRelation>();
  for (const domain of domains) {
    if (domain.parentId && ids.has(domain.parentId)) {
      const parent = domains.find(item => item.id === domain.parentId);
      relations.set(`${domain.parentId}:${domain.id}`, { from: domain.parentId, to: domain.id,
        kind: parent?.definitionKind === 'core' && domain.definitionKind === 'business' ? 'membership' : 'parent' });
    }
  }
  for (const membership of memberships) {
    if (domains.some(domain => domain.id === membership.coreId && domain.definitionKind === 'core')
      && domains.some(domain => domain.id === membership.businessId && domain.definitionKind === 'business')) {
      relations.set(`${membership.coreId}:${membership.businessId}`, { from: membership.coreId, to: membership.businessId, kind: 'membership' });
    }
  }
  return [...relations.values()];
}
export function reaches(relations: DomainRelation[], from: string, target: string): boolean {
  const pending = [from], seen = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...relations.filter(edge => edge.from === id).map(edge => edge.to));
  }
  return false;
}
