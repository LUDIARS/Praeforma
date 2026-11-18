import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.ts';
import { FragmentList } from './FragmentList.tsx';
import { StructuredSpecList } from './StructuredSpecList.tsx';
import '../../styles/spec-workspace.css';

/**
 * プロジェクトの基本画面。現在の体系仕様と断片仕様を並べて確認する (spec/feature/spec-review-home.md)。
 * 登録・整理・再構築は「仕様」タブで行い、ここは確認に絞る。
 */
export function SpecReviewHome({ pid, focus, onOpenSpecs }: {
  pid: string; focus: string | null; onOpenSpecs: (kind: 'structured' | 'fragment') => void;
}): React.ReactElement {
  const specsQ = useQuery({ queryKey: ['specs', pid], queryFn: () => api.listSpecs(pid) });
  return <div className="spec-review-home">
    <section className="panel spec-review-column" aria-labelledby="spec-review-structured">
      <div className="spec-review-head">
        <h3 id="spec-review-structured">体系仕様{specsQ.isSuccess && ` (${specsQ.data.items.length})`}</h3>
        <button type="button" className="ghost" onClick={() => onOpenSpecs('structured')}>編集する</button>
      </div>
      {specsQ.isPending && <p role="status">読み込み中…</p>}
      {specsQ.isError && <p role="alert">体系仕様を取得できませんでした。<button type="button" onClick={() => { void specsQ.refetch(); }}>再取得</button></p>}
      {specsQ.isSuccess && specsQ.data.items.length === 0 && <p>体系仕様はまだありません。断片がまとまったら「仕様」タブで体系化します。</p>}
      {specsQ.isSuccess && <StructuredSpecList pid={pid} specs={specsQ.data.items} focus={focus} />}
    </section>
    <section className="panel spec-review-column" aria-labelledby="spec-review-fragments">
      <div className="spec-review-head">
        <h3 id="spec-review-fragments">断片仕様</h3>
        <button type="button" className="ghost" onClick={() => onOpenSpecs('fragment')}>登録・編集する</button>
      </div>
      <FragmentList key={pid} pid={pid} readOnly />
    </section>
  </div>;
}
