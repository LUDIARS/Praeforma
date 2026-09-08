import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Layout } from '../../lib/api.ts';

export function SceneRegistration({ pid }: { pid: string }): React.ReactElement {
  const client = useQueryClient();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [kind, setKind] = React.useState<Layout['kind']>('ui-2d');
  const mutation = useMutation({
    mutationFn: () => api.createLayout(pid, { name: name.trim(), description: description.trim(), kind }),
    onSuccess: async () => {
      setName(''); setDescription('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['layouts', pid] }),
        client.invalidateQueries({ queryKey: ['domain-definitions', pid] }),
      ]);
    },
  });
  return <form className="foundation-form" onSubmit={(event) => {
    event.preventDefault();
    if (name.trim() && !mutation.isPending) mutation.mutate();
  }}>
    <h3>シーンを登録</h3>
    <fieldset disabled={mutation.isPending} style={{ border: 0, padding: 0 }} className="foundation-form">
      <label className="simple-field"><span>シーン名（必須）</span>
        <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="simple-field"><span>種類</span>
        <select value={kind} onChange={(event) => setKind(event.target.value as Layout['kind'])}>
          <option value="ui-2d">UI（2D）</option><option value="world-2d">ワールド（2D）</option><option value="world-3d">ワールド（3D）</option>
        </select>
      </label>
      <label className="simple-field"><span>説明</span>
        <textarea maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="simple-actions"><button className="primary" type="submit" disabled={!name.trim()}>
        {mutation.isPending ? '登録中…' : 'シーンを登録'}
      </button></div>
    </fieldset>
    {mutation.isError && <p role="alert">登録できませんでした。編集権限を確認してください。入力は残っています。</p>}
    {mutation.isSuccess && <p role="status">シーンを登録しました。</p>}
  </form>;
}
