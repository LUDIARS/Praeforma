// 全プロジェクトの企画概要書の一覧 (spec/feature/concept-sheet.md PF-CS-8)。各シートは最新版を出す (PF-CS-10)。
// 見られるプロジェクトごとに一覧 API を呼び、カードから各プロジェクトの 1 枚を開く。
import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, type Project } from '../lib/api.ts';
import { conceptSheetApi, conceptSheetError } from '../lib/concept-sheets-api.ts';
import type { ConceptSheetSummary } from '../../../shared/concept-sheet.ts';
import { ConceptSheetBadges } from '../components/concept-sheets/ConceptSheetWorkspace.tsx';
import '../styles/concept-sheets.css';

type ProjectSheets = { project: Project; items: ConceptSheetSummary[]; error: string | null };

async function loadAll(): Promise<ProjectSheets[]> {
  const { items: projects } = await api.listProjects();
  // 1 つのプロジェクトで失敗しても、ほかのプロジェクトの一覧は出す。
  return Promise.all(projects.map(async (project) => {
    try { return { project, items: (await conceptSheetApi.list(project.id)).items, error: null }; }
    catch (e) { return { project, items: [], error: conceptSheetError(e) }; }
  }));
}

export function ConceptSheetsIndexPage(): React.ReactElement {
  const query = useQuery({ queryKey: ['concept-sheets-index'], queryFn: loadAll });
  const groups = (query.data ?? []).filter((g) => g.items.length > 0 || g.error);
  return <div className="panel concept-sheet-index">
    <h2>企画概要書の一覧</h2>
    <p style={{ color: 'var(--muted)', margin: 0 }}>各プロジェクトの UX と画面から、Astra がデザインした 1 枚の企画概要書の最新版です。過去の版や新しく作るときは、プロジェクトの「企画概要書」タブを開きます。</p>
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">一覧を取得できませんでした。</p>}
    {query.isSuccess && groups.length === 0 && <p>まだ企画概要書はありません。</p>}
    {groups.map(({ project, items, error }) => <section key={project.id} aria-label={`${project.name} の企画概要書`}>
      <h3><Link to={`/projects/${project.id}?tab=concept-sheets`}>{project.name}</Link></h3>
      {error && <p role="alert">{error}</p>}
      <div className="concept-sheet-cards">
        {items.map((item) => <Link key={item.id} className="concept-sheet-card"
          to={`/projects/${project.id}?tab=concept-sheets&sheet=${encodeURIComponent(item.id)}`}>
          <strong>{item.catchcopy}</strong><span>{item.title}</span>
          <span className="concept-sheet-concept">{item.concept}</span>
          <span>現在の画面：{item.sceneLabel}</span>
          <ConceptSheetBadges item={item} /><span>{item.updatedAt.slice(0, 10)}</span>
        </Link>)}
      </div>
    </section>)}
  </div>;
}
