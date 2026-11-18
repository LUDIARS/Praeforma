import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ProjectEvent, ProjectEventKind } from '../../../../shared/project-home.ts';
import { projectHomeApi } from '../../lib/project-home-api.ts';
import type { ProjectTab } from '../ProjectTabs.tsx';
import '../../styles/project-home.css';

const KIND_LABELS: Record<ProjectEventKind, string> = {
  fragment: '断片', systematize: '体系化', scene: 'シーン', transition: '遷移', spec: '仕様', actor: 'アクター',
};

const timeFormat = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * プロジェクトのファーストビュー (spec/feature/project-dashboard.md)。
 * 断片の追加・体系化・シーンの編集などの最近の出来事を新しい順に並べる。断片は Cc やスキルから自動で入る。
 */
export function ProjectDashboard({ pid, onOpenTab }: { pid: string; onOpenTab: (tab: ProjectTab) => void }): React.ReactElement {
  const query = useQuery({ queryKey: ['project-events', pid], queryFn: () => projectHomeApi.events(pid) });
  return <section className="panel project-dashboard" aria-labelledby="dashboard-events">
    <div className="home-head">
      <h3 id="dashboard-events">最近の出来事</h3>
      <div className="simple-actions">
        <button type="button" className="ghost" onClick={() => onOpenTab('spec-review')}>仕様確認</button>
        <button type="button" className="ghost" onClick={() => onOpenTab('flow-diagram')}>遷移図</button>
        <button type="button" className="ghost" onClick={() => onOpenTab('ux-definition')}>UX定義</button>
        <button type="button" className="ghost" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>
          {query.isFetching ? '更新中…' : '更新'}</button>
      </div>
    </div>
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">出来事を取得できませんでした。<button type="button" onClick={() => { void query.refetch(); }}>再取得</button></p>}
    {query.isSuccess && query.data.items.length === 0 && <p>まだ出来事はありません。断片が追加されるとここに出ます。</p>}
    {query.isSuccess && query.data.items.length > 0 && <ol className="event-list">
      {query.data.items.map((event) => <EventRow key={event.id} pid={pid} event={event} onOpenTab={onOpenTab} />)}
    </ol>}
  </section>;
}

function EventRow({ pid, event, onOpenTab }: { pid: string; event: ProjectEvent; onOpenTab: (tab: ProjectTab) => void }): React.ReactElement {
  const target = event.target;
  const open = target?.kind === 'layout' && event.title !== 'シーンを削除'
    ? <Link to={`/projects/${pid}/layouts/${encodeURIComponent(target.id)}`}>開く</Link>
    : event.kind === 'fragment' || event.kind === 'systematize' || event.kind === 'spec'
      ? <button type="button" className="link-button" onClick={() => onOpenTab('spec-review')}>仕様確認で見る</button>
      : event.kind === 'transition'
        ? <button type="button" className="link-button" onClick={() => onOpenTab('flow-diagram')}>遷移図で見る</button>
        : null;
  return <li className="event-row">
    <time dateTime={event.at} className="event-time">{timeFormat.format(new Date(event.at))}</time>
    <span className={`event-kind event-kind-${event.kind}`}>{KIND_LABELS[event.kind]}</span>
    <div className="event-body">
      <div><strong>{event.title}</strong>{event.detail && <span className="event-detail"> {event.detail}</span>}</div>
      <div className="fragment-meta">{event.actor && <span>{event.actor}</span>}{open}</div>
    </div>
  </li>;
}
