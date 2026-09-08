/** Project entry point for the schema and logical storage designer. PF-DATA-1/9. */
import React from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, type ApiError } from '../lib/api.ts';
import { getDataDesign } from '../lib/data-design-api.ts';
import { DataDesignEditor } from '../components/data-design/DataDesignEditor.tsx';
import '../styles/data-design.css';

export function DataDesignPage(): React.ReactElement {
  const { pid } = useParams();
  const project = useQuery({ queryKey: ['project', pid], queryFn: () => api.getProject(pid!), enabled: !!pid });
  const design = useQuery({ queryKey: ['data-design', pid], queryFn: () => getDataDesign(pid!), enabled: !!pid });
  if (!pid) return <p role="alert">プロジェクトが指定されていません。</p>;
  if (design.isPending) return <p role="status">データ設計を読み込み中…</p>;
  if (!design.data) {
    const status = (design.error as ApiError | null)?.status;
    return <div className="panel" role="alert"><p>{status === 403 ? 'データ設計を閲覧する権限がありません。'
      : status === 404 ? 'プロジェクトが見つかりません。'
      : 'データ設計を取得できませんでした。通信とサービスの状態を確認してください。'}</p>
      <button type="button" className="ghost" disabled={design.isFetching} onClick={() => { void design.refetch(); }}>再取得</button>
    </div>;
  }
  return <>
    <div className="panel">
      <Link to={'/projects/' + pid}>← {project.data?.project.name ?? 'プロジェクト'}へ戻る</Link>
      <h1>データスキーマと保存先</h1>
      <p>各データをどこに持ち、誰が読めるかを設計します。</p>
      <p className="data-hint">ここで保存するのは設計情報です。Cr の実データ・テーブル・権限への適用は行いません。</p>
    </div>
    <DataDesignEditor key={pid} pid={pid} initial={design.data} />
  </>;
}
