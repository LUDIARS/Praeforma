import { domainRelations, type DomainMembership, type RelationDomain } from './domain-relations.ts';

/**
 * 概要の TODO は、 コアドメインとビジネスドメインのつながりだけを見る (spec/feature/ux-definition-todos.md)。
 * 実装コードのドメイン所属 (プログラムドメイン) は Anatomia 側で別に運用し、 ここには混ぜない。
 */
export type DomainLinkTodoKind = 'missing-core' | 'unclassified-domain' | 'unlinked-business' | 'empty-core';

export interface DomainLinkTodo {
  ref: string;
  kind: DomainLinkTodoKind;
  name: string;
  evidence: string;
  /** 解決先のドメイン。 コアが 1 件も無いときは null。 */
  domainId: string | null;
}

export interface TodoDomain extends RelationDomain { name: string }

const ORDER: Record<DomainLinkTodoKind, number> = { 'missing-core': 0, 'unclassified-domain': 1, 'unlinked-business': 2, 'empty-core': 3 };

export function domainLinkTodos(projectId: string, domains: TodoDomain[], memberships: DomainMembership[]): DomainLinkTodo[] {
  const ref = (kind: DomainLinkTodoKind, id: string): string => `pf:${projectId}:${kind}:${id}`;
  const linked = domainRelations(domains, memberships).filter(edge => edge.kind === 'membership');
  const cores = domains.filter(domain => domain.definitionKind === 'core');
  const items: DomainLinkTodo[] = [];
  if (cores.length === 0) {
    items.push({ ref: ref('missing-core', projectId), kind: 'missing-core', name: 'コアドメイン', domainId: null,
      evidence: 'コアドメインが 1 件も定義されていません。体験の中心になるコアを定義し、ビジネスドメインをつなげます。' });
  }
  for (const domain of domains) {
    if (domain.definitionKind === null) {
      items.push({ ref: ref('unclassified-domain', domain.id), kind: 'unclassified-domain', name: domain.name, domainId: domain.id,
        evidence: 'コアかビジネスかの分類が未定義です。' });
    } else if (domain.definitionKind === 'business' && !linked.some(edge => edge.to === domain.id)) {
      items.push({ ref: ref('unlinked-business', domain.id), kind: 'unlinked-business', name: domain.name, domainId: domain.id,
        evidence: 'どのコアドメインにも属していません。' });
    } else if (domain.definitionKind === 'core' && !linked.some(edge => edge.from === domain.id)) {
      items.push({ ref: ref('empty-core', domain.id), kind: 'empty-core', name: domain.name, domainId: domain.id,
        evidence: 'このコアに属するビジネスドメインがありません。' });
    }
  }
  return items.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.name.localeCompare(b.name) || a.ref.localeCompare(b.ref));
}
