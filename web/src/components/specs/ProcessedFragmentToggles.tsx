import React from 'react';
import type { FragmentCounts } from '../../../../shared/project-home.ts';
import { FragmentList } from './FragmentList.tsx';

/**
 * 体系化で処理した断片 (PF-HOME-10)。採用 (統合済) と却下 (棄却) を、それぞれ閉じたトグルに入れる。
 * 中身は開いたときに初めて読む。
 */
export function ProcessedFragmentToggles({ pid, counts }: { pid: string; counts: FragmentCounts | null }): React.ReactElement {
  return <div className="spec-review-toggles">
    <Toggle pid={pid} disposition="integrated" title="体系に採用した断片" count={counts?.integrated} empty="採用した断片はありません。" />
    <Toggle pid={pid} disposition="rejected" title="体系化で却下した断片" count={counts?.rejected} empty="却下した断片はありません。" />
  </div>;
}

function Toggle({ pid, disposition, title, count, empty }: {
  pid: string; disposition: 'integrated' | 'rejected'; title: string; count: number | undefined; empty: string;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  return <details className="fragment-toggle" data-state={disposition} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{title}{count === undefined ? '' : ` (${count})`}</summary>
    {open && <FragmentList key={`${pid}:${disposition}`} pid={pid} readOnly disposition={disposition} emptyText={empty} />}
  </details>;
}
