import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.ts';
import { fragmentApi } from '../../lib/spec-fragments-api.ts';
import { CategorizedSpecList } from './CategorizedSpecList.tsx';
import { FragmentList } from './FragmentList.tsx';
import { ProcessedFragmentToggles } from './ProcessedFragmentToggles.tsx';
import '../../styles/spec-workspace.css';

type ReviewTab = 'structured' | 'fragments' | 'pending';

/**
 * プロジェクトの基本画面「仕様確認」(spec/feature/spec-review-home.md PF-HOME-8〜12)。
 * 体系 (カテゴリごとのいまの版) / 断片 (採用・却下をトグルで閉じる) / 保留中 の 3 タブ。
 * 登録・整理・再構築は「仕様の編集」タブで行い、ここは確認に絞る。
 */
export function SpecReviewHome({ pid, focus, onOpenSpecs }: {
  pid: string; focus: string | null; onOpenSpecs: (kind: 'structured' | 'fragment') => void;
}): React.ReactElement {
  const [tab, setTab] = React.useState<ReviewTab>('structured');
  const specsQ = useQuery({ queryKey: ['specs', pid], queryFn: () => api.listSpecs(pid) });
  const countsQ = useQuery({ queryKey: ['spec-fragment-counts', pid], queryFn: () => fragmentApi.counts(pid) });
  const pending = countsQ.data?.pending ?? 0;
  const tabs: Array<{ id: ReviewTab; label: string; badge?: number }> = [
    { id: 'structured', label: specsQ.isSuccess ? `体系 (${specsQ.data.items.length})` : '体系' },
    { id: 'fragments', label: countsQ.isSuccess ? `断片 (${countsQ.data.integrated + countsQ.data.rejected})` : '断片' },
    { id: 'pending', label: '保留中', badge: pending },
  ];
  return <section className="panel spec-review-home" aria-labelledby="spec-review-title">
    <div className="spec-review-head">
      <h3 id="spec-review-title">仕様確認</h3>
      <button type="button" className="ghost" onClick={() => onOpenSpecs(tab === 'structured' ? 'structured' : 'fragment')}>
        {tab === 'structured' ? '体系を編集する' : '断片を登録・編集する'}</button>
    </div>
    <div className="spec-review-tabs" role="tablist" aria-label="仕様確認の表示">
      {tabs.map((item) => <button key={item.id} type="button" role="tab" id={`spec-review-tab-${item.id}`}
        aria-selected={tab === item.id} aria-controls={`spec-review-panel-${item.id}`}
        className={tab === item.id ? 'active' : undefined} data-attention={item.badge ? 'true' : undefined}
        onClick={() => setTab(item.id)}>
        {item.label}{item.badge ? <span className="spec-review-badge" aria-label={`${item.badge} 件`}>{item.badge}</span> : null}
      </button>)}
    </div>
    <div role="tabpanel" id={`spec-review-panel-${tab}`} aria-labelledby={`spec-review-tab-${tab}`} className="spec-review-panel">
      {tab === 'structured' && <>
        {specsQ.isPending && <p role="status">読み込み中…</p>}
        {specsQ.isError && <p role="alert">体系仕様を取得できませんでした。<button type="button" onClick={() => { void specsQ.refetch(); }}>再取得</button></p>}
        {specsQ.isSuccess && specsQ.data.items.length === 0 && <p>体系仕様はまだありません。断片がまとまったら「仕様の編集」タブで体系化します。</p>}
        {specsQ.isSuccess && specsQ.data.items.length > 0 && <CategorizedSpecList pid={pid} specs={specsQ.data.items} focus={focus} />}
      </>}
      {tab === 'fragments' && <>
        {pending > 0 && <p className="spec-review-notice">まだ体系化していない断片が {pending} 件あります。
          <button type="button" className="link-button" onClick={() => setTab('pending')}>保留中を見る</button></p>}
        <ProcessedFragmentToggles pid={pid} counts={countsQ.data ?? null} />
      </>}
      {tab === 'pending' && <>
        <p className="meta">まだ体系化で採用も却下もしていない断片です。新しい順に並べています。</p>
        <FragmentList key={`${pid}:pending`} pid={pid} readOnly disposition="pending" openCards emptyText="保留中の断片はありません。" />
      </>}
    </div>
  </section>;
}
