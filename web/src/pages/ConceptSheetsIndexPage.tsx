// 全プロジェクトの企画概要書の一覧 (spec/feature/concept-sheet.md PF-CS-8)。各シートは最新版を出す (PF-CS-10)。
// 生成済みの紙面そのものを更新の新しい順に並べ、クリックでそのプロジェクトの 1 枚を開く。
import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, type Project } from '../lib/api.ts';
import { conceptSheetApi, conceptSheetError } from '../lib/concept-sheets-api.ts';
import { arrangeConceptSheetIndex, type ConceptSheetIndexGroup } from '../../../shared/concept-sheet-index.ts';
import { ConceptSheetBadges } from '../components/concept-sheets/ConceptSheetWorkspace.tsx';
import { ConceptSheetThumbnail } from '../components/concept-sheets/ConceptSheetThumbnail.tsx';
import '../styles/concept-sheets.css';

async function loadAll(): Promise<ConceptSheetIndexGroup<Project>[]> {
  const { items: projects } = await api.listProjects();
  // 1 つのプロジェクトで失敗しても、ほかのプロジェクトの一覧は出す。
  return Promise.all(projects.map(async (project) => {
    try { return { project, items: (await conceptSheetApi.list(project.id)).items, error: null }; }
    catch (e) { return { project, items: [], error: conceptSheetError(e) }; }
  }));
}

export function ConceptSheetsIndexPage(): React.ReactElement {
  const query = useQuery({ queryKey: ['concept-sheets-index'], queryFn: loadAll });
  const { entries, failures } = React.useMemo(() => arrangeConceptSheetIndex(query.data ?? []), [query.data]);
  return <div className="panel concept-sheet-index">
    <h2>企画概要書の一覧</h2>
    <p style={{ color: 'var(--muted)', margin: 0 }}>各プロジェクトで生成済みの企画概要書（最新版）です。紙面を押すと、そのプロジェクトの「企画概要書」タブで開きます（過去の版・作り直し・印刷はそこから）。</p>
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">一覧を取得できませんでした。</p>}
    {failures.map(({ project, error }) => <p key={project.id} role="alert">{project.name}：{error}</p>)}
    {query.isSuccess && entries.length === 0 && failures.length === 0 && <p>まだ企画概要書はありません。</p>}
    <div className="concept-sheet-cards">
      {entries.map(({ project, sheet }) => <Link key={`${project.id}:${sheet.id}`} className="concept-sheet-card"
        aria-label={`${project.name}：${sheet.title} の企画概要書を開く`}
        to={`/projects/${project.id}?tab=concept-sheets&sheet=${encodeURIComponent(sheet.id)}`}>
        <ConceptSheetThumbnail pid={project.id} sheetId={sheet.id} title={sheet.title} />
        <strong>{sheet.catchcopy}</strong>
        <span>{project.name}・{sheet.title}</span>
        <ConceptSheetBadges item={sheet} /><span>{sheet.updatedAt.slice(0, 10)}</span>
      </Link>)}
    </div>
  </div>;
}
