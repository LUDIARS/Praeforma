// ビジュアルタブ (spec/feature/project-visuals.md)。コンセプトアート / キービジュアル / スクリーンショットを登録し、
// 名前・メモ・一押しを直し、削除する。企画概要書はここから候補を選んで作る (spec/feature/concept-sheet.md PF-CS-12)。
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { VISUAL_KINDS, VISUAL_KIND_LABELS } from '../../../../shared/project-visual.ts';
import { visualApi } from '../../lib/project-visuals-api.ts';
import { VisualCard } from './VisualCard.tsx';
import { VisualUploadForm } from './VisualUploadForm.tsx';
import '../../styles/project-visuals.css';

export function ProjectVisuals({ pid }: { pid: string }): React.ReactElement {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['project-visuals', pid], queryFn: () => visualApi.list(pid) });
  const refresh = (): Promise<void> => queryClient.invalidateQueries({ queryKey: ['project-visuals', pid] });

  if (query.isPending) return <section className="panel"><p role="status">ビジュアルを読み込み中…</p></section>;
  if (!query.data) {
    return <section className="panel" role="alert">ビジュアルを取得できませんでした。
      <button type="button" onClick={() => { void query.refetch(); }}>再取得</button></section>;
  }
  const { canEdit, items, max } = query.data;
  return <section className="panel project-visuals">
    <h3>ビジュアル（{items.length}/{max}）</h3>
    <p className="project-visual-hint">コンセプトアート・キービジュアル・ゲームプレイやツール画面のスクリーンショットを登録します。
      企画概要書は、ここから候補（最大 6 枚）を選んで作ります。「一押し」は一番面白そうな画面の印です。</p>
    {canEdit && <details className="project-visual-register">
      <summary>ビジュアルを登録する</summary>
      <VisualUploadForm pid={pid} disabled={items.length >= max} onCreated={refresh} />
    </details>}
    {VISUAL_KINDS.map((kind) => {
      const group = items.filter((v) => v.kind === kind);
      return <section key={kind} aria-label={VISUAL_KIND_LABELS[kind]}>
        <h4>{VISUAL_KIND_LABELS[kind]}（{group.length}）</h4>
        {group.length === 0 && <p className="project-visual-hint">まだありません。</p>}
        <div className="project-visual-grid">
          {group.map((visual) => <VisualCard key={`${visual.id}:${visual.revision}`} pid={pid} visual={visual}
            canEdit={canEdit} onChanged={refresh} />)}
        </div>
      </section>;
    })}
  </section>;
}
