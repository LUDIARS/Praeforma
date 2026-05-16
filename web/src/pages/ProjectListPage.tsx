import React from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

export function ProjectListPage(): React.ReactElement {
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: ['projects'], queryFn: () => api.listProjects() });
  const [name, setName] = React.useState('');
  const [orgId, setOrgId] = React.useState('');

  const createM = useMutation({
    mutationFn: () => api.createProject({ name, org_id: orgId, platforms: ['web', 'unity'] }),
    onSuccess: () => {
      setName(''); setOrgId('');
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return (
    <>
      <div className="panel foundation-form">
        <h2>新しい Project</h2>
        <div className="simple-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Game" />
        </div>
        <div className="simple-field">
          <span>Org ID (Cernere organization UUID)</span>
          <input value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="org_..." />
        </div>
        <div className="simple-actions">
          <button
            className="primary"
            type="button"
            disabled={!name || !orgId || createM.isPending}
            onClick={() => createM.mutate()}
          >
            Create
          </button>
        </div>
        {createM.isError && <p style={{ color: 'var(--danger)' }}>作成に失敗しました</p>}
      </div>

      <div className="panel">
        <h2>Projects</h2>
        {listQ.isLoading && <p>loading…</p>}
        {listQ.isError && <p style={{ color: 'var(--danger)' }}>取得に失敗しました</p>}
        {listQ.data && listQ.data.items.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>まだ project がありません。 上のフォームから作成してください。</p>
        )}
        <ul className="item-list">
          {listQ.data?.items.map((p) => (
            <li key={p.id} className="item-row">
              <div className="label">
                <Link to={`/projects/${p.id}`}>{p.name}</Link>
              </div>
              <div className="meta">
                {p.id} {p.description && `— ${p.description}`}
              </div>
              <div className="meta">platforms: {p.platforms.join(', ')}</div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
