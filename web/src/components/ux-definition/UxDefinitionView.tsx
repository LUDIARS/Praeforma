import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { uxDesignApi } from '../../lib/ux-design-api.ts';
import { ProjectUxGoal } from '../ProjectUxGoal.tsx';
import { DomainDefinitionsPanel } from '../domain-definitions/DomainDefinitionsPanel.tsx';
import { ProjectVisuals } from '../visuals/ProjectVisuals.tsx';
import '../../styles/project-home.css';

const SECTIONS = [
  ['ux-vision', 'ヴィジョン・ストーリー'], ['ux-scenarios', 'シナリオ'], ['ux-domains', 'ドメイン'], ['ux-visuals', 'コンセプトアート'],
] as const;

/**
 * UX定義 (spec/feature/ux-definition.md)。ゲーム全体のヴィジョンを 1 か所で描く。
 * UX・ストーリー (カスタマージャーニー)・シナリオ・ドメイン・コンセプトアートを順に並べる。各部の編集は既存の部品で行う。
 */
export function UxDefinitionView({ pid }: { pid: string }): React.ReactElement {
  return <div className="ux-definition">
    <nav className="panel ux-definition-nav" aria-label="UX定義の目次">
      {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} onClick={(event) => {
        event.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}>{label}</a>)}
    </nav>
    <section id="ux-vision" aria-label="ヴィジョン・ストーリー"><ProjectUxGoal pid={pid} /></section>
    <section id="ux-scenarios" className="panel" aria-labelledby="ux-scenarios-title"><ScenarioOverview pid={pid} /></section>
    <section id="ux-domains" aria-label="ドメイン"><DomainDefinitionsPanel pid={pid} /></section>
    <section id="ux-visuals" aria-label="コンセプトアート"><ProjectVisuals pid={pid} /></section>
  </div>;
}

function ScenarioOverview({ pid }: { pid: string }): React.ReactElement {
  const query = useQuery({ queryKey: ['ux-scenarios', pid], queryFn: () => uxDesignApi.listScenarios(pid) });
  return <>
    <div className="home-head">
      <h3 id="ux-scenarios-title">シナリオ{query.isSuccess && ` (${query.data.items.length})`}</h3>
      <Link to={`/projects/${pid}/ux-design`} className="ghost">シナリオを編集</Link>
    </div>
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">シナリオを取得できませんでした。</p>}
    {query.isSuccess && query.data.items.length === 0 && <p>シナリオはまだありません。</p>}
    {query.isSuccess && query.data.items.length > 0 && <ul className="item-list">
      {query.data.items.map((s) => <li key={s.id} className="item-row">
        <div className="label">{s.name} <span className="role-badge">{s.status === 'reviewed' ? '確認済' : '下書き'}</span></div>
        <div className="meta">{[s.actor, s.goal].filter(Boolean).join(' / ')}</div>
      </li>)}
    </ul>}
  </>;
}
