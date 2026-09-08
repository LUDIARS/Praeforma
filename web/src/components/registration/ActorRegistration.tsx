import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.ts';
import { DomainSelect } from './DomainSelect.tsx';

export function ActorRegistration({ pid }: { pid: string }): React.ReactElement {
  const client = useQueryClient();
  const [label, setLabel] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const [description, setDescription] = React.useState('');
  const mutation = useMutation({
    mutationFn: () => api.createObject(pid, { label: label.trim(), domain_id: domain, description: description.trim() }),
    onSuccess: async () => {
      setLabel('');
      setDescription('');
      await client.invalidateQueries({ queryKey: ['objects', pid] });
    },
  });
  return <form className="foundation-form" onSubmit={(event) => {
    event.preventDefault();
    if (label.trim() && domain && !mutation.isPending) mutation.mutate();
  }}>
    <h3>アクターを登録</h3>
    <fieldset disabled={mutation.isPending} style={{ border: 0, padding: 0 }} className="foundation-form">
      <label className="simple-field"><span>アクター名（必須）</span>
        <input required maxLength={200} value={label} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <DomainSelect pid={pid} value={domain} onChange={setDomain} />
      <label className="simple-field"><span>説明</span>
        <textarea maxLength={4000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="simple-actions"><button className="primary" type="submit" disabled={!label.trim() || !domain}>
        {mutation.isPending ? '登録中…' : 'アクターを登録'}
      </button></div>
    </fieldset>
    {mutation.isError && <p role="alert">登録できませんでした。ドメイン・編集権限を確認してください。入力は残っています。</p>}
    {mutation.isSuccess && <p role="status">アクターを登録しました。</p>}
  </form>;
}
