import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PfObject } from '../lib/api.ts';
import { domainDefinitionsApi } from '../lib/domain-definitions-api.ts';
import { DomainCards } from './domain-definitions/DomainCards.tsx';

export function ActorCards({ pid, actors }: { pid: string; actors: PfObject[] }): React.ReactElement {
  const query = useQuery({ queryKey: ['domain-definitions', pid], queryFn: () => domainDefinitionsApi.read(pid) });
  return <ul className="entity-card-list">{actors.map((actor) => {
    const domain = query.data?.items.find((item) => item.id === actor.domainId);
    return <li key={actor.id} className="item-row entity-card">
      <details>
        <summary><strong>{actor.label}</strong>
          <span className="entity-description">{actor.description || '説明は未登録です。'}</span>
          {domain && <span className="meta">所属：{domain.name}</span>}
        </summary>
        <div className="entity-children">
          <h4>所属ドメイン</h4>
          {query.isPending && <p>読み込み中…</p>}
          {query.isError && <p role="alert">ドメインを取得できませんでした。
            <button type="button" className="ghost" onClick={() => { void query.refetch(); }}>再取得</button>
          </p>}
          {query.isSuccess && !domain && <p>所属ドメインを参照できません。</p>}
          {domain && query.data && <DomainCards domains={query.data.items} roots={[domain]} />}
        </div>
      </details>
    </li>;
  })}</ul>;
}
