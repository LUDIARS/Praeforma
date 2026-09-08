import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { domainDefinitionsApi, type DefinedDomain } from '../../lib/domain-definitions-api.ts';
import { domainRelations, reaches, type DomainMembership } from '../../../../shared/domain-relations.ts';

export function BusinessDomainAssignment({ pid, coreId, domains, memberships }: {
  pid: string; coreId: string; domains: DefinedDomain[]; memberships: DomainMembership[];
}): React.ReactElement {
  const client = useQueryClient();
  const [selected, setSelected] = React.useState<string[]>([]);
  const relations = domainRelations(domains, memberships);
  const options = domains.filter((domain) => domain.definitionKind === 'business'
    && !relations.some(edge => edge.from === coreId && edge.to === domain.id)
    && !reaches(relations, domain.id, coreId));
  const selection = options.filter(domain => selected.includes(domain.id));
  const mutation = useMutation({
    mutationFn: (ids: string[]) => domainDefinitionsApi.assignBusinesses(pid, coreId, ids),
    onSuccess: () => { setSelected([]); },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['domain-definitions', pid] }),
        client.invalidateQueries({ queryKey: ['domains', pid] }),
      ]);
    },
  });
  return <form className="foundation-form" onSubmit={(event) => {
    event.preventDefault();
    if (selection.length && selection.length <= 100 && !mutation.isPending) mutation.mutate(selection.map(domain => domain.id));
  }}>
    <label className="simple-field"><span>追加するビジネスドメイン（複数選択）</span>
      <select multiple size={Math.min(8, Math.max(3, options.length))} style={{ minWidth: 0, maxWidth: '100%' }}
        value={selection.map(domain => domain.id)} disabled={mutation.isPending || !options.length}
        onChange={(event) => { setSelected(Array.from(event.target.selectedOptions, option => option.value)); mutation.reset(); }}>
        {options.map((domain) => {
          const owners = relations.filter(edge => edge.to === domain.id && edge.kind === 'membership')
            .map(edge => domains.find(item => item.id === edge.from)?.name).filter(Boolean);
          return <option key={domain.id} value={domain.id}>{domain.name}{owners.length ? `（所属: ${owners.join('、')}）` : ''}</option>;
        })}
      </select>
    </label>
    <p className="meta">他のコアドメインに所属していても追加できます。PCはCtrl / Commandキーで複数選択できます。</p>
    {!options.length && <p>追加できるビジネスドメインはありません。</p>}
    {selection.map(domain => <p key={domain.id} className="entity-description"><strong>{domain.name}</strong>：{domain.description || domain.definitionValue}</p>)}
    <div className="simple-actions"><button type="submit" className="primary" disabled={!selection.length || selection.length > 100 || mutation.isPending}>
      {mutation.isPending ? '追加中…' : `選択した${selection.length}件を追加`}
    </button></div>
    {mutation.isError && <p role="alert">追加できませんでした。ドメインの分類・関係・編集権限を確認してください。</p>}
    {mutation.isSuccess && <p role="status">ビジネスドメインを追加しました。</p>}
  </form>;
}
