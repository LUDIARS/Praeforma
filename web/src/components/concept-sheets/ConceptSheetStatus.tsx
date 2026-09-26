// 生成・自動更新の状態の表示 (spec/feature/concept-sheet.md PF-CS-9 / PF-CS-11)。
// 走っている (人の作成・作り直し / 自動更新)・失敗した (理由)・自動更新の予約 (いつごろ走るか) を出す。
import React from 'react';
import type { ConceptSheetGenerationStatus } from '../../../../shared/concept-sheet.ts';
import { conceptSheetJobError } from '../../lib/concept-sheets-api.ts';

const hhmm = (iso: string): string => new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

export function ConceptSheetStatus({ status, titleOf }: {
  status: ConceptSheetGenerationStatus | null; titleOf: (sheetId: string) => string | undefined;
}): React.ReactElement | null {
  if (!status) return null;
  const { job, autoUpdate } = status;
  const which = (sheetId: string): string => { const title = titleOf(sheetId); return title ? `「${title}」の` : ''; };
  return <>
    {job?.state === 'running' && <p className="concept-sheet-notice" role="status">
      {job.trigger === 'auto'
        ? `UX・仕様・ビジュアルの変更を受けて、${which(job.sheetId)}企画概要書を自動更新しています（${hhmm(job.startedAt)} 開始、数分〜十数分）。できたら新しい版になります。`
        : `Astra が企画概要書をデザインしています（${hhmm(job.startedAt)} 開始、数分〜十数分）。できたら自動で開きます。`}</p>}
    {job?.state === 'failed' && <p role="alert">
      {job.trigger === 'auto' ? `${which(job.sheetId)}自動更新に失敗しました（${hhmm(job.finishedAt)}）。次に UX・仕様・ビジュアルが変わったときにもう一度試します。` : ''}
      {conceptSheetJobError(job.error)}</p>}
    {autoUpdate.scheduledAt && job?.state !== 'running' && <p className="concept-sheet-hint" role="status">
      UX・仕様・ビジュアルが変わりました。変更が落ち着いたら（{hhmm(autoUpdate.scheduledAt)} ごろ）自動更新 ON の企画概要書を作り直します。</p>}
  </>;
}
