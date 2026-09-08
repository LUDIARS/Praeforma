import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api.ts';
import type { DefinedDomain } from '../../lib/domain-definitions-api.ts';

export function DomainRegistration({ pid, kind, domains, onCreated, onCancel }: {
  pid: string; kind: 'core' | 'business'; domains: DefinedDomain[];
  onCreated: (id: string) => Promise<void>; onCancel: () => void;
}): React.ReactElement {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [value, setValue] = React.useState('');
  const [parent, setParent] = React.useState('');
  const mutation = useMutation({
    mutationFn: () => api.createDomain(pid, {
      name: name.trim(), description: description.trim(), parent_id: parent || null,
      definition: { kind, value: value.trim() },
    }),
    onSuccess: async (result) => { await onCreated(result.domain.id); },
  });
  return <section className="panel">
    <h3>{kind === 'core' ? 'コアドメイン' : 'ビジネスドメイン'}を登録</h3>
    <form className="foundation-form" onSubmit={(event) => {
      event.preventDefault();
      if (name.trim() && value.trim() && !mutation.isPending) mutation.mutate();
    }}>
      <fieldset disabled={mutation.isPending} className="foundation-form" style={{ border: 0, padding: 0 }}>
        <label className="simple-field"><span>ドメイン名（必須）</span>
          <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="simple-field"><span>説明</span>
          <textarea rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="simple-field"><span>提供する価値（必須）</span>
          <textarea required rows={3} maxLength={4000} value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <label className="simple-field"><span>親ドメイン</span>
          <select value={parent} onChange={(event) => setParent(event.target.value)}>
            <option value="">なし（最上位）</option>
            {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
          </select>
        </label>
        <div className="simple-actions">
          <button type="button" className="ghost" onClick={onCancel}>キャンセル</button>
          <button type="submit" className="primary" disabled={!name.trim() || !value.trim()}>
            {mutation.isPending ? '登録中…' : '登録する'}
          </button>
        </div>
      </fieldset>
      {mutation.isError && <p role="alert">登録できませんでした。名前の重複・親ドメイン・編集権限を確認してください。入力は残っています。</p>}
    </form>
  </section>;
}
