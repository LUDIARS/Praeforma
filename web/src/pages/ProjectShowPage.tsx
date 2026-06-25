import React from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

type Tab = 'overview' | 'domains' | 'objects' | 'layouts' | 'specs';

export function ProjectShowPage(): React.ReactElement {
  const { pid } = useParams();
  const [tab, setTab] = React.useState<Tab>('overview');
  const projectQ = useQuery({
    queryKey: ['project', pid],
    queryFn: () => api.getProject(pid!),
    enabled: !!pid,
  });
  const membersQ = useQuery({
    queryKey: ['project-members', pid],
    queryFn: () => api.listMembers(pid!),
    enabled: !!pid && tab === 'overview',
  });
  const domainsQ = useQuery({
    queryKey: ['domains', pid],
    queryFn: () => api.listDomains(pid!),
    enabled: !!pid && tab === 'domains',
  });
  const objectsQ = useQuery({
    queryKey: ['objects', pid],
    queryFn: () => api.listObjects(pid!),
    enabled: !!pid && tab === 'objects',
  });
  const layoutsQ = useQuery({
    queryKey: ['layouts', pid],
    queryFn: () => api.listLayouts(pid!),
    enabled: !!pid && (tab === 'layouts' || tab === 'overview'),
  });
  const specsQ = useQuery({
    queryKey: ['specs', pid],
    queryFn: () => api.listSpecs(pid!),
    enabled: !!pid && tab === 'specs',
  });

  if (!pid) return <p>missing project id</p>;
  if (projectQ.isLoading) return <p>loading…</p>;
  if (projectQ.isError || !projectQ.data) return <p style={{ color: 'var(--danger)' }}>取得失敗</p>;
  const p = projectQ.data.project;

  return (
    <>
      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>{p.name}</h2>
          <div style={{ flex: 1 }} />
          <Link to={`/projects/${pid}/studio`} className="primary" style={{ textDecoration: 'none' }}>
            要件定義モード →
          </Link>
        </div>
        <p style={{ color: 'var(--muted)' }}>{p.description}</p>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {p.id} / platforms: {p.platforms.join(', ')}
        </div>
      </div>

      <div className="tabbar">
        {(['overview', 'domains', 'objects', 'layouts', 'specs'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="panel">
            <h3>Members ({membersQ.data?.items.length ?? 0})</h3>
            <ul className="item-list">
              {membersQ.data?.items.map((m) => (
                <li key={m.id} className="item-row">
                  <div className="label">
                    {m.display_name ?? m.user_id} <span className="role-badge">{m.role}</span>
                  </div>
                  <div className="meta">{m.user_id}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>Layouts ({layoutsQ.data?.items.length ?? 0})</h3>
            <ul className="item-list">
              {layoutsQ.data?.items.map((l) => (
                <li key={l.id} className="item-row">
                  <Link to={`/projects/${pid}/layouts/${l.id}`}>{l.name}</Link>
                  <div className="meta">{l.kind}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {tab === 'domains' && (
        <div className="panel">
          <h3>Domains</h3>
          {domainsQ.isLoading && <p>loading…</p>}
          <ul className="item-list">
            {domainsQ.data?.items.map((d) => (
              <li key={d.id} className="item-row">
                <div className="label">
                  <span style={{
                    display: 'inline-block', width: 12, height: 12,
                    background: d.color, borderRadius: 3, marginRight: 6, verticalAlign: 'middle',
                  }} />
                  {d.name}
                </div>
                <div className="meta">{d.description}</div>
                <div className="meta">required_attrs: {d.required_attrs.map((a) => a.name).join(', ') || '(none)'}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'objects' && (
        <div className="panel">
          <h3>Objects</h3>
          {objectsQ.isLoading && <p>loading…</p>}
          <ul className="item-list">
            {objectsQ.data?.items.map((o) => (
              <li key={o.id} className="item-row">
                <div className="label">{o.label}</div>
                <div className="meta">
                  {o.placeholder_shape} {o.placeholder_color} / domain={o.domain_id}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'layouts' && (
        <div className="panel">
          <h3>Layouts</h3>
          {layoutsQ.isLoading && <p>loading…</p>}
          <ul className="item-list">
            {layoutsQ.data?.items.map((l) => (
              <li key={l.id} className="item-row">
                <Link to={`/projects/${pid}/layouts/${l.id}`}>{l.name}</Link>
                <div className="meta">{l.kind} {l.is_default && '(default)'}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'specs' && (
        <div className="panel">
          <h3>Specs</h3>
          {specsQ.isLoading && <p>loading…</p>}
          <ul className="item-list">
            {specsQ.data?.items.map((s) => (
              <li key={s.id} className="item-row">
                <div className="label">
                  {s.code} — {s.title}
                  <span className="role-badge">{s.status}</span>
                </div>
                <div className="meta">priority={s.priority} category={s.category}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
