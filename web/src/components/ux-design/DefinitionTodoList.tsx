import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { req } from '../../lib/api.ts';
import type { DomainLinkTodo, DomainLinkTodoKind } from '../../../../shared/domain-link-todos.ts';

interface Props {
  projectId: string;
  onOpen: (todo: DomainLinkTodo) => void;
}

const labels: Record<DomainLinkTodoKind, string> = {
  'missing-core': 'コアドメインが未定義',
  'unclassified-domain': '分類が未定義',
  'unlinked-business': 'コアに未所属のビジネスドメイン',
  'empty-core': 'ビジネスドメインが無いコア',
};

/** コアドメインとビジネスドメインのつながりの TODO。 実装コードの所属 (プログラムドメイン) は扱わない。 */
export function DefinitionTodoList({ projectId, onOpen }: Props): React.ReactElement {
  const [limit, setLimit] = React.useState(20);
  const [filter, setFilter] = React.useState('');
  const query = useQuery({ queryKey: ['ux-definition-todos', projectId], queryFn: () => req<{ items: DomainLinkTodo[] }>(`/api/projects/${encodeURIComponent(projectId)}/ux-design/definition-todos`) });
  const items = (query.data?.items ?? []).filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()));
  return <section className="ux-definition-todos">
    <div className="ux-section-heading"><div><h2>TODO</h2><p>コアドメインとビジネスドメインをつなげて、ドメインと仕様の関係を整えます。</p></div><button type="button" className="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>一覧を更新</button></div>
    <p className="muted">実装コードのドメイン所属 (プログラムドメイン) はここでは扱いません。</p>
    <label className="simple-field"><span>名前で絞り込む</span><input type="search" value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(20); }} /></label>
    {query.isPending ? <p role="status">読み込み中…</p> : null}
    {query.isError ? <p role="alert" className="error">TODOを取得できません。再取得してください。未取得を「課題なし」とは扱いません。</p> : null}
    {query.data && !query.isError ? <><p>{items.length}件{query.isFetching ? '（更新中）' : ''}</p><ol className="ux-definition-todo-list">{items.slice(0, limit).map((item) =>
      <li key={item.ref}><span className="ux-kicker">{labels[item.kind]}</span><h3>{item.name}</h3><p>{item.evidence}</p><button type="button" className="primary" onClick={() => onOpen(item)}>ドメインで関連付ける</button></li>,
    )}</ol>{items.length === 0 ? <p>{filter ? '検索条件に一致する項目はありません。' : 'コアとビジネスのつながりに未整理の項目はありません。'}</p> : null}{items.length > limit ? <button className="ghost" type="button" onClick={() => setLimit((value) => value + 20)}>次の20件</button> : null}</> : null}
  </section>;
}
