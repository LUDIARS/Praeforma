import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { req, type ApiError } from '../../lib/api.ts';
import type { UxScenario } from '../../lib/ux-design-api.ts';

export interface DefinitionTodo {
  ref: string;
  kind: 'unassigned-code' | 'missing-purpose' | 'unlinked-domain';
  name: string;
  evidence: string;
}

interface Props {
  projectId: string;
  scenarios: UxScenario[];
  canOpen: boolean;
  onDefine: (todo: DefinitionTodo) => void;
  onOpen: (id: string) => void;
}

const labels = { 'unassigned-code': 'ドメイン未所属の実装', 'missing-purpose': '目的が未定義', 'unlinked-domain': '実装との対応付けなし' };

export function DefinitionTodoList({ projectId, scenarios, canOpen, onDefine, onOpen }: Props): React.ReactElement {
  const [limit, setLimit] = React.useState(20);
  const [filter, setFilter] = React.useState('');
  const query = useQuery({ queryKey: ['ux-definition-todos', projectId], queryFn: () => req<{ knowledgeHead: string | null; items: DefinitionTodo[] }>(`/api/projects/${encodeURIComponent(projectId)}/ux-design/definition-todos`) });
  const linked = new Map<string, UxScenario>();
  for (const scenario of scenarios) for (const ref of scenario.sourceRefs) if (!linked.has(ref)) linked.set(ref, scenario);
  const items = (query.data?.items ?? []).filter((item) => `${item.name} ${item.evidence}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => Number(linked.has(a.ref)) - Number(linked.has(b.ref)) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.ref.localeCompare(b.ref));
  const error = (query.error as ApiError | null)?.body as { error?: string } | undefined;
  return <section className="ux-definition-todos">
    <div className="ux-section-heading"><div><h2>ドメイン整理 TODO</h2><p>上から項目を選び、誰のために何を実現する実装かを定義します。</p></div><button type="button" className="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>一覧を更新</button></div>
    <p className="muted">UXを保存しても実装の課題は自動で解決扱いにしません。対応付けや不要候補の判断は、根拠を確認して進めます。</p>
    <label className="simple-field"><span>名前・ファイルで絞り込む</span><input type="search" value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(20); }} /></label>
    {query.isPending ? <p role="status">Anatomia の根拠を読み込み中…</p> : null}
    {query.isError ? <p role="alert" className="error">TODOを取得できません。{error?.error === 'anatomia_repo_unset' ? 'プロジェクト設定で Anatomia リポジトリを指定してください。' : error?.error === 'anatomia_unconfigured' ? 'Pf の Anatomia 接続先を設定してください。' : 'Anatomia の接続・解析状態を確認して再取得してください。'} 未取得を「課題なし」とは扱いません。</p> : null}
    {query.data && !query.isError ? <><p>{items.length}件{query.isFetching ? '（更新中）' : ''}</p><ol className="ux-definition-todo-list">{items.slice(0, limit).map((item) => {
      const scenario = linked.get(item.ref);
      return <li key={item.ref}><span className="ux-kicker">{labels[item.kind]}</span><h3>{item.name}</h3><p>{item.evidence}</p><button type="button" className="primary" disabled={!canOpen} onClick={() => scenario ? onOpen(scenario.id) : onDefine(item)}>{scenario ? 'UX定義を続ける' : 'この項目のUXを定義する'}</button></li>;
    })}</ol>{items.length === 0 ? <p>{filter ? '検索条件に一致する項目はありません。' : '取得した分類に該当するTODOはありません。呼び出しの配線検証はこの一覧の対象外です。'}</p> : null}{items.length > limit ? <button className="ghost" type="button" onClick={() => setLimit((value) => value + 20)}>次の20件</button> : null}</> : null}
  </section>;
}
