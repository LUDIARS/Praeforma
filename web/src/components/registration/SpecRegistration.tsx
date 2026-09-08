import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.ts';
import { DomainSelect } from './DomainSelect.tsx';

export function SpecRegistration({ pid }: { pid: string }): React.ReactElement {
  const client = useQueryClient();
  const [code, setCode] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const mutation = useMutation({
    mutationFn: () => api.createSpec(pid, {
      code: code.trim(), title: title.trim(), description: description.trim(),
      targets: [{ kind: 'domain', ref_id: domain }],
    }),
    onSuccess: async () => {
      setCode(''); setTitle(''); setDescription('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['specs', pid] }),
        client.invalidateQueries({ queryKey: ['domain-definitions', pid] }),
      ]);
    },
  });
  return <form className="foundation-form" onSubmit={(event) => {
    event.preventDefault();
    if (code.trim() && title.trim() && domain && !mutation.isPending) mutation.mutate();
  }}>
    <h3>仕様を登録</h3>
    <fieldset disabled={mutation.isPending} style={{ border: 0, padding: 0 }} className="foundation-form">
      <DomainSelect pid={pid} value={domain} onChange={setDomain} />
      <label className="simple-field"><span>仕様コード（必須）</span>
        <input required maxLength={100} value={code} onChange={(event) => setCode(event.target.value)} />
      </label>
      <label className="simple-field"><span>タイトル（必須）</span>
        <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="simple-field"><span>説明</span>
        <textarea maxLength={20000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="simple-actions"><button type="submit" className="primary" disabled={!code.trim() || !title.trim() || !domain}>
        {mutation.isPending ? '登録中…' : '仕様を登録'}
      </button></div>
    </fieldset>
    {mutation.isError && <p role="alert">登録できませんでした。仕様コードの重複・ドメイン・編集権限を確認してください。入力は残っています。</p>}
    {mutation.isSuccess && <p role="status">仕様を登録しました。</p>}
  </form>;
}
