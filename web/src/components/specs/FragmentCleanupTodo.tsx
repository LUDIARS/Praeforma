import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { fragmentApi } from '../../lib/spec-fragments-api.ts';

/** PF-FRAGMENT-TODO-1/3: project-level entry point with role-specific guidance. */
export function FragmentCleanupTodo({ pid }: { pid: string }): React.ReactElement {
  const query = useQuery({ queryKey: ['fragment-cleanup-todo', pid], queryFn: () => fragmentApi.cleanupTodo(pid) });
  return <section className="panel">
    <h2>断片整理のTODO</h2>
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">整理状況を取得できませんでした。
      <button type="button" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>再取得</button>
    </p>}
    {query.isSuccess && (query.data.pendingCount > 0 ? <>
      <p>未整理の断片 {query.data.pendingCount}件を確認し、体系へ整理する。</p>
      <p>再構築案を確認して確定すると、統合した断片がTODOから外れます。保留した断片は残ります。</p>
      <Link to={`/projects/${encodeURIComponent(pid)}?tab=specs&spec_kind=fragment&reconstruct=1`}>
        {query.data.canReconstruct ? '再構築を開く' : '断片を確認する'}
      </Link>
      {!query.data.canReconstruct && <p>再構築の実行・確定はオーナーまたはプランナーが行います。</p>}
    </> : <p>未整理の断片はありません。</p>)}
  </section>;
}
