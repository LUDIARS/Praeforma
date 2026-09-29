import React from 'react';
import { Link } from 'react-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { useProjectFilters } from '../lib/use-project-filters.ts';
import { ProjectSearch } from '../components/ProjectSearch.tsx';

export function ProjectListPage(): React.ReactElement {
  const qc = useQueryClient();
  const { filters, error, update } = useProjectFilters();
  // 最近 git 更新があった順に 50 件ずつ。「もっと見る」で続きを足す (2026-09-29 neco)。
  const listQ = useInfiniteQuery({ queryKey: ['projects', filters.query, filters.team], initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.listProjectIndex(filters, pageParam, signal),
    getNextPageParam: (last, pages) => { const loaded = pages.reduce((n, page) => n + page.items.length, 0); return last.items.length && loaded < last.total ? loaded : undefined; } });
  const first = listQ.data?.pages[0];
  const shown = listQ.data?.pages.flatMap(page => page.items) ?? [];
  const [name, setName] = React.useState('');
  const [orgId, setOrgId] = React.useState('');
  const createM = useMutation({
    mutationFn: () => api.createProject({ name: name.trim(), org_id: orgId.trim(), platforms: ['web', 'unity'] }),
    onSuccess: () => { setName(''); setOrgId(''); qc.invalidateQueries({ queryKey: ['projects'] }); },
  });
  return <>
    <ProjectSearch filters={filters} teams={first?.teams ?? []} error={error} onChange={update} />
    <section className="panel" aria-label="プロジェクト一覧">
      <h2>プロジェクト {first ? '(' + first.total + ' 件)' : ''}</h2>
      {listQ.isPending ? <p>読み込み中…</p> : null}
      {listQ.isError ? <p role="alert">取得に失敗しました。<button type="button" onClick={() => listQ.refetch()}>再取得</button></p> : null}
      {first?.total === 0 ? <p>該当するプロジェクトはありません。絞り込みを変更するか、下のフォームから作成してください。</p> : null}
      <ul className="item-list">{shown.map(project => <li key={project.id} className="item-row">
        <div className="label"><Link to={'/projects/' + project.id}>{project.name}</Link></div>
        <div className="meta">{project.description}</div><div className="meta">チーム: {project.orgId === 'local' ? '個人用' : project.orgId} / {project.platforms.join(', ')}{project.gitUpdatedAt ? ' / git 更新: ' + project.gitUpdatedAt.slice(0, 10) : ''}</div>
      </li>)}</ul>
      {first && first.total > 0 ? <div className="project-list-more"><span className="meta">{shown.length} / {first.total} 件を表示</span>{listQ.hasNextPage ? <button type="button" disabled={listQ.isFetchingNextPage} onClick={() => listQ.fetchNextPage()}>{listQ.isFetchingNextPage ? '読み込み中…' : 'もっと見る'}</button> : null}</div> : null}
    </section>
    <form className="panel foundation-form" onSubmit={event => { event.preventDefault(); createM.mutate(); }}>
      <h2>新しいプロジェクト</h2>
      <label className="simple-field"><span>プロジェクト名</span><input required maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder="My Game" /></label>
      <label className="simple-field"><span>チーム ID</span><input required value={orgId} onChange={event => setOrgId(event.target.value)} placeholder="Cernere の組織 ID" /></label>
      <button className="primary" type="submit" disabled={!name.trim() || !orgId.trim() || createM.isPending}>作成</button>
      {createM.isError ? <p role="alert">作成に失敗しました。</p> : null}
      {createM.isSuccess ? <p role="status"><Link to={'/projects/' + createM.data.project.id}>作成したプロジェクトを開く</Link></p> : null}
    </form>
  </>;
}
