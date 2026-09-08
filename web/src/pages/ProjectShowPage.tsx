import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { DomainDefinitionsPanel } from '../components/domain-definitions/DomainDefinitionsPanel.tsx';
import { parseDeeplinkTab, useFocusEntity } from '../lib/deeplink.ts';
import { ProjectUxGoal } from '../components/ProjectUxGoal.tsx';
import { ProjectTabs, type ProjectTab } from '../components/ProjectTabs.tsx';
import { ActorRegistration } from '../components/registration/ActorRegistration.tsx';
import { SceneRegistration } from '../components/registration/SceneRegistration.tsx';
import { SpecRegistration } from '../components/registration/SpecRegistration.tsx';
import { ActorCards } from '../components/ActorCards.tsx';

type Tab = ProjectTab;

export function ProjectShowPage(): React.ReactElement {
  const { pid } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // Thaleia ディープリンク `?tab=&focus=` を消費する (発行側契約は lib/deeplink.ts 参照)。
  // 概要・アクター・UX/ゴールはPf内部の共有URLにも対応する。
  const rawTab = searchParams.get('tab');
  const deeplinkTab: Tab | null = rawTab === 'ux-goal' || rawTab === 'overview' || rawTab === 'objects'
    ? rawTab : parseDeeplinkTab(rawTab);
  const focus = searchParams.get('focus');
  const [tab, setTab] = React.useState<Tab>(() => deeplinkTab ?? 'overview');
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
  // domains タブは DomainDefinitionsPanel が自前で取得する (ここでは引かない)。
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

  // ディープリンクの `?tab` が後から変わった場合に追従する (初期値は useState で設定済み)。
  React.useEffect(() => {
    if (deeplinkTab) setTab(deeplinkTab);
  }, [deeplinkTab]);

  // 該当タブのデータ取得が完了したら `?focus` のエンティティへスクロール/ハイライトする。
  const focusReady =
    (tab === 'specs' && specsQ.isSuccess) ||
    (tab === 'layouts' && layoutsQ.isSuccess);
  const { notFound: focusNotFound } = useFocusEntity(focus, focusReady);

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
          <Link to={`/projects/${pid}/data-design`} className="ghost">データ設計 →</Link>
          <Link to={`/projects/${pid}/ux-design`} className="primary" style={{ textDecoration: 'none' }}>
            UX / Core Domain Design →
          </Link>
          <details>
            <summary className="ghost">旧設計ビュー</summary>
            <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
              <Link to={`/projects/${pid}/studio`}>旧 要件定義モード</Link>
              <Link to={`/projects/${pid}/flow`}>旧 Screen Flow</Link>
            </div>
          </details>
        </div>
        <p style={{ color: 'var(--muted)' }}>{p.description}</p>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {p.id} / platforms: {p.platforms.join(', ')}
        </div>
      </div>

      {focusNotFound && (
        <div className="panel" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          リンク先の項目「{focusNotFound}」が見つかりませんでした (ページは表示しています)。
        </div>
      )}

      <ProjectTabs key={`tabs:${pid}`} tab={tab} onChange={(next) => {
        setTab(next);
        setSearchParams((current) => {
          const params = new URLSearchParams(current);
          params.set('tab', next);
          params.delete('focus');
          return params;
        });
      }} />

      {tab === 'ux-goal' && <ProjectUxGoal key={`ux-goal:${pid}`} pid={pid} />}

      {tab === 'overview' && (
        <>
          <div className="panel">
            <h3>メンバー ({membersQ.data?.items.length ?? 0})</h3>
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
            <h3>シーン ({layoutsQ.data?.items.length ?? 0})</h3>
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

      {tab === 'domains' && <DomainDefinitionsPanel key={`domains:${pid}`} pid={pid} />}

      {tab === 'objects' && (
        <div className="panel">
          <ActorRegistration key={pid} pid={pid} />
          <h3>アクター</h3>
          {objectsQ.isLoading && <p>読み込み中…</p>}
          {objectsQ.isError && <p role="alert">アクターを取得できませんでした。</p>}
          {objectsQ.isSuccess && objectsQ.data.items.length === 0 && <p>アクターは未登録です。</p>}
          <ActorCards pid={pid} actors={objectsQ.data?.items ?? []} />
        </div>
      )}

      {tab === 'layouts' && (
        <div className="panel">
          <SceneRegistration key={pid} pid={pid} />
          <h3>シーン</h3>
          {layoutsQ.isLoading && <p>読み込み中…</p>}
          {layoutsQ.isError && <p role="alert">シーンを取得できませんでした。</p>}
          <ul className="item-list">
            {layoutsQ.data?.items.map((l) => (
              <li key={l.id} className="item-row" data-focus={l.name}>
                <Link to={`/projects/${pid}/layouts/${l.id}`}>{l.name}</Link>
                <div className="meta">{l.kind} {l.is_default && '(default)'}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'specs' && (
        <div className="panel">
          <SpecRegistration key={pid} pid={pid} />
          <h3>仕様</h3>
          {specsQ.isLoading && <p>読み込み中…</p>}
          {specsQ.isError && <p role="alert">仕様を取得できませんでした。</p>}
          <ul className="item-list">
            {specsQ.data?.items.map((s) => (
              <li key={s.id} className="item-row" data-focus={s.code}>
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
