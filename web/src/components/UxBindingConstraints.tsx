// UX タブに出す「この UX を縛る制約」 (spec/feature/project-constraints.md PF-CON-3)。
// 制約タブの「企画」の制約を読み取り専用で並べ、編集は制約タブへ移って行う。
import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { constraintApi } from '../lib/project-constraints-api.ts';

export function UxBindingConstraints({ pid }: { pid: string }): React.ReactElement {
  const query = useQuery({ queryKey: ['project-constraints', pid], queryFn: () => constraintApi.list(pid) });
  const planning = (query.data?.items ?? []).filter((c) => c.kind === 'planning');
  return <section aria-labelledby="ux-binding-constraints" style={{ marginBottom: 20 }}>
    <strong id="ux-binding-constraints">この UX を縛る制約（企画）</strong>
    <span style={{ display: 'block', color: 'var(--muted)', margin: '6px 0' }}>
      企画として守る条件です。UX はこの範囲で考えます。追加・変更は
      <Link to={`/projects/${encodeURIComponent(pid)}?tab=constraints`}>制約タブ</Link>で行います。
    </span>
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">制約を取得できませんでした。「制約なし」とは扱いません。</p>}
    {query.isSuccess && planning.length === 0 && <p style={{ margin: 0 }}>企画の制約はまだありません。</p>}
    {planning.length > 0 && <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
      {planning.map((c) => <li key={c.id}>
        <span>{c.title}</span>
        {c.detail && <span style={{ display: 'block', color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{c.detail}</span>}
      </li>)}
    </ul>}
  </section>;
}
