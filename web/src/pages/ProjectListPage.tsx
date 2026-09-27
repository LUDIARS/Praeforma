import React from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { useProjectFilters } from '../lib/use-project-filters.ts';
import { ProjectSearch } from '../components/ProjectSearch.tsx';

export function ProjectListPage(): React.ReactElement {
  const qc = useQueryClient();
  const { filters, error, update } = useProjectFilters();
  const [offset, setOffset] = React.useState(0);
  const listQ = useQuery({ queryKey: ['projects', filters.query, filters.team, offset],
    queryFn: ({ signal }) => api.listProjectIndex(filters, offset, signal) });
  const [name, setName] = React.useState('');
  const [orgId, setOrgId] = React.useState('');
  const createM = useMutation({
    mutationFn: () => api.createProject({ name: name.trim(), org_id: orgId.trim(), platforms: ['web', 'unity'] }),
    onSuccess: () => { setName(''); setOrgId(''); qc.invalidateQueries({ queryKey: ['projects'] }); },
  });
  return <>
    <ProjectSearch filters={filters} teams={listQ.data?.teams ?? []} error={error} onChange={patch => { update(patch); setOffset(0); }} />
    <section className="panel" aria-label="プロジェクト一覧">
      <h2>プロジェクト {listQ.data ? '(' + listQ.data.total + ' 件)' : ''}</h2>
      {listQ.isPending ? <p>読み込み中…</p> : null}
      {listQ.isError ? <p role="alert">取得に失敗しました。<button type="button" onClick={() => listQ.refetch()}>再取得</button></p> : null}
      {listQ.data?.total === 0 ? <p>該当するプロジェクトはありません。絞り込みを変更するか、下のフォームから作成してください。</p> : null}
      <ul className="item-list">{listQ.data?.items.map(project => <li key={project.id} className="item-row">
        <div className="label"><Link to={'/projects/' + project.id}>{project.name}</Link></div>
        <div className="meta">{project.description}</div><div className="meta">チーム: {project.orgId === 'local' ? '個人用' : project.orgId} / {project.platforms.join(', ')}</div>
      </li>)}</ul>
      <nav aria-label="一覧のページ"><button type="button" disabled={offset === 0 || listQ.isFetching} onClick={() => setOffset(Math.max(0, offset - 50))}>前へ</button><button type="button" disabled={!listQ.data || offset + 50 >= listQ.data.total || listQ.isFetching} onClick={() => setOffset(offset + 50)}>次へ</button></nav>
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
