import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { domainDefinitionsApi, type DefinedDomain } from '../../lib/domain-definitions-api.ts';

export function BusinessDomainAssignment({ pid, coreId, domains, ancestors }: {
  pid: string; coreId: string; domains: DefinedDomain[]; ancestors: string[];
}): React.ReactElement {
  const client = useQueryClient();
  const [selected, setSelected] = React.useState('');
  const options = domains.filter((domain) => domain.definitionKind === 'business'
    && domain.parentId === null && !ancestors.includes(domain.id));
  const selection = options.find((domain) => domain.id === selected);
  const mutation = useMutation({
    mutationFn: (id: string) => domainDefinitionsApi.assignBusiness(pid, coreId, id),
    onSuccess: () => { setSelected(''); },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['domain-definitions', pid] }),
        client.invalidateQueries({ queryKey: ['domains', pid] }),
      ]);
    },
  });
  return <form className="foundation-form" onSubmit={(event) => {
    event.preventDefault();
    if (selection && !mutation.isPending) mutation.mutate(selection.id);
  }}>
    <label className="simple-field"><span>未配置のビジネスドメイン</span>
      <select value={selection?.id ?? ''} disabled={mutation.isPending || !options.length}
        onChange={(event) => { setSelected(event.target.value); mutation.reset(); }}>
        <option value="">{options.length ? '追加するドメインを選択' : '未配置のビジネスドメインはありません'}</option>
        {options.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
      </select>
    </label>
    {selection && <p className="entity-description">{selection.description || selection.definitionValue}</p>}
    <div className="simple-actions"><button type="submit" className="primary" disabled={!selection || mutation.isPending}>
      {mutation.isPending ? '追加中…' : '追加する'}
    </button></div>
    {mutation.isError && <p role="alert">追加できませんでした。別の場所への配置や編集権限を確認してください。</p>}
    {mutation.isSuccess && <p role="status">ビジネスドメインを追加しました。</p>}
  </form>;
}
