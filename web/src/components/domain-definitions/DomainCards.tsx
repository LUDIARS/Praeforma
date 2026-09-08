import React from 'react';
import type { DefinedDomain } from '../../lib/domain-definitions-api.ts';
import '../../styles/entity-cards.css';
import { BusinessDomainAssignment } from './BusinessDomainAssignment.tsx';
import { domainRelations, reaches, type DomainMembership } from '../../../../shared/domain-relations.ts';

const GROUPS = [
  { kind: 'core', label: 'コアドメイン' },
  { kind: 'business', label: 'ビジネスドメイン' },
  { kind: null, label: '未分類のドメイン' },
] as const;

/** 既存データに循環があっても到達不能なボックスを作らない。 */
function rootDomains(domains: DefinedDomain[], memberships: DomainMembership[]): DefinedDomain[] {
  const relations = domainRelations(domains, memberships);
  const covered = new Set<string>();
  const roots: DefinedDomain[] = [];
  function cover(id: string): void {
    if (covered.has(id)) return;
    covered.add(id);
    relations.filter(edge => edge.from === id).forEach(edge => cover(edge.to));
  }
  const candidates = [...domains.filter(domain => !relations.some(edge => edge.to === domain.id)), ...domains];
  for (const domain of candidates) {
    if (!covered.has(domain.id)) { roots.push(domain); cover(domain.id); }
  }
  return roots;
}

export function DomainCards({ pid, domains, memberships = [], onEdit, focus, roots, sceneIds, ancestors = [] }: {
  memberships?: DomainMembership[];
  pid?: string;
  domains: DefinedDomain[]; onEdit?: (domain: DefinedDomain) => void; focus?: string | null;
  roots?: DefinedDomain[]; ancestors?: string[]; sceneIds?: string[];
}): React.ReactElement {
  const relations = domainRelations(domains, memberships);
  const items = (roots ?? rootDomains(domains, memberships)).filter((domain) => !ancestors.includes(domain.id));
  return <div className="domain-card-groups">
    {GROUPS.map((group) => {
      const members = items.filter((domain) => domain.definitionKind === group.kind);
      if (!members.length) return null;
      return <section key={group.kind ?? 'undefined'} aria-label={group.label}>
        <h3>{group.label}</h3>
        <ul className="entity-card-list">{members.map((domain) => {
          const children = domains.filter(child => relations.some(edge => edge.from === domain.id && edge.to === child.id)
            && !ancestors.includes(child.id) && child.id !== domain.id);
          const path = [...ancestors, domain.id];
          // ディープリンク先まで親を開き、focus スクロールを可視領域へ着地させる。
          const focused = domains.find((item) => item.name === focus);
          const containsFocus = !!focused && reaches(relations, domain.id, focused.id);
          return <li key={domain.id} className="item-row entity-card" data-focus={domain.name}>
            <details open={containsFocus || undefined}>
              <summary><strong>{domain.name}</strong>
                <span className="entity-description">{domain.description || domain.definitionValue || '説明は未登録です。'}</span>
                <span className="meta">子ドメイン {children.length}件</span>
                {domain.definitionKind === 'core' && !domain.definitionSceneIds.some((id) => !sceneIds || sceneIds.includes(id)) && <span role="status"> ⚠ シーン未露出</span>}
              </summary>
              <div className="entity-children">
                {domain.definitionValue && <p className="entity-description">提供する価値：{domain.definitionValue}</p>}
                {onEdit && <button type="button" className="ghost" onClick={() => onEdit(domain)}>定義を編集</button>}
                {pid && domain.definitionKind === 'core' && <BusinessDomainAssignment pid={pid} coreId={domain.id} domains={domains} memberships={memberships} />}
                {children.length ? <DomainCards pid={pid} domains={domains} memberships={memberships} roots={children} ancestors={path} onEdit={onEdit} focus={focus} sceneIds={sceneIds} />
                  : <p className="meta">子ドメインはありません。</p>}
              </div>
            </details>
          </li>;
        })}</ul>
      </section>;
    })}
  </div>;
}
