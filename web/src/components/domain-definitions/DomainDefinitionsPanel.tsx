import React from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { domainDefinitionsApi } from '../../lib/domain-definitions-api.ts';
import { DomainDefinitionEditor } from './DomainDefinitionEditor.tsx';
import { DomainRegistration } from './DomainRegistration.tsx';
import { DomainCards } from './DomainCards.tsx';
import { useFocusEntity } from '../../lib/deeplink.ts';

export function DomainDefinitionsPanel({ pid }: { pid: string }): React.ReactElement {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['domain-definitions', pid], queryFn: () => domainDefinitionsApi.read(pid) });
  const [selected, setSelected] = React.useState('');
  const [registration, setRegistration] = React.useState<'core' | 'business' | null>(null);
  const [search] = useSearchParams();
  const focus = search.get('focus');
  const { notFound } = useFocusEntity(focus, query.isSuccess);
  async function reload(): Promise<void> {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['domain-definitions', pid] }),
      client.invalidateQueries({ queryKey: ['domains', pid] }),
    ]);
  }
  const domain = query.data?.items.find((item) => item.id === selected);
  return <>
    <section className="panel">
      <h3>ドメイン定義</h3>
      <nav className="entity-menu" aria-label="ドメイン定義メニュー">
        <button type="button" className="primary" aria-pressed={registration === 'core'} onClick={() => { setSelected(''); setRegistration('core'); }}>コアドメインを登録</button>
        <button type="button" className="ghost" aria-pressed={registration === 'business'} onClick={() => { setSelected(''); setRegistration('business'); }}>ビジネスドメインを登録</button>
        <button type="button" className="ghost" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>一覧を再取得</button>
      </nav>
    </section>
    {registration && <DomainRegistration key={registration} pid={pid} kind={registration} domains={query.data?.items ?? []}
      onCancel={() => setRegistration(null)} onCreated={async (id) => { setSelected(id); setRegistration(null); await reload(); }} />}
    {domain && query.data && <DomainDefinitionEditor key={domain.id} pid={pid} domain={domain} data={query.data} onSaved={reload} />}
    {query.isPending && <p>読み込み中…</p>}
    {query.isError && <p role="alert">定義を取得できませんでした。</p>}
    {notFound && <p role="alert">リンク先のドメイン「{notFound}」が見つかりません。</p>}
    {query.isSuccess && query.data.items.length === 0 && <p>ドメインは未登録です。上のメニューから登録してください。</p>}
    {query.data && <DomainCards domains={query.data.items} sceneIds={query.data.scenes.map((scene) => scene.id)} focus={focus} onEdit={(item) => { setRegistration(null); setSelected(item.id); }} />}
  </>;
}
