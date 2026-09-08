// ドメイン定義の一覧 + 追加 (spec/feature/domain-definition-links.md)。
// PF-DL-W1 (価値から各対応を同じ画面で読める) / PF-DL-INV2 (有効なシーン参照が無い core を警告)。

import React from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.ts';
import { domainDefinitionsApi } from '../../lib/domain-definitions-api.ts';
import { DomainDefinitionEditor } from './DomainDefinitionEditor.tsx';
import { useFocusEntity } from '../../lib/deeplink.ts';

export function DomainDefinitionsPanel({ pid }: { pid: string }): React.ReactElement {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['domain-definitions', pid], queryFn: () => domainDefinitionsApi.read(pid) });
  const [selected, setSelected] = React.useState('');
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search] = useSearchParams();
  const focus = search.get('focus');
  const { notFound } = useFocusEntity(focus, query.isSuccess);
  async function reload(): Promise<void> {
    await client.invalidateQueries({ queryKey: ['domain-definitions', pid] });
    await client.invalidateQueries({ queryKey: ['domains', pid] });
  }
  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault(); setBusy(true); setError(null);
    try { const result = await api.createDomain(pid, { name: name.trim() }); setSelected(result.domain.id); setName(''); await reload(); }
    catch { setError('作成できませんでした。名前の重複や編集権限を確認してください。'); }
    finally { setBusy(false); }
  }
  const domain = query.data?.items.find((d) => d.id === selected);
  return <>
    <div className="panel">
      <h3>ドメイン定義</h3>
      <p>価値を定義し、要件・露出するシーン定義・Anatomiaのドメインを関連付けます。</p>
      <form onSubmit={(e) => { void create(e); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input aria-label="新しいドメイン名" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        <button type="submit" disabled={busy || !name.trim()}>ドメインを追加</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {query.isPending && <p>読み込み中…</p>}
      {query.isError && <p role="alert">定義を取得できませんでした。</p>}
      {notFound && <p role="alert">リンク先のドメイン「{notFound}」が見つかりません。</p>}
      <button type="button" onClick={() => { void query.refetch(); }}>一覧を再取得</button>
      <ul className="item-list">{query.data?.items.map((d) => <li key={d.id} data-focus={d.name}>
        <button type="button" onClick={() => setSelected(d.id)} aria-pressed={selected === d.id}>
          {d.name} — {d.definitionKind === 'core' ? 'コア' : d.definitionKind === 'business' ? 'ビジネス' : '未定義'}
        </button>
        {d.definitionKind === 'core' && !d.definitionSceneIds.some((id) => query.data?.scenes.some((s) => s.id === id))
          && <span role="status"> ⚠ シーン未露出</span>}
      </li>)}</ul>
    </div>
    {domain && query.data && <DomainDefinitionEditor key={domain.id}
      pid={pid} domain={domain} data={query.data} onSaved={reload} />}
  </>;
}
