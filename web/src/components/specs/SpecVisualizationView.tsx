import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.ts';
import { specVersionsApi } from '../../lib/spec-versions-api.ts';
import { downloadText } from '../../lib/download-text.ts';
import { specViewDocument, type SpecViewAxis } from '../../../../shared/spec-view.ts';
import { telaSpecView } from '../../../../shared/tela-spec-view-export.ts';
import { SpecViewCanvas } from './SpecViewCanvas.tsx';
import '../../styles/spec-view.css';

const AXES: readonly (readonly [SpecViewAxis, string])[] = [
  ['status', '状態'], ['category', '分類'], ['priority', '優先度'],
];

/**
 * 仕様書可視化ビュー (PF-SPEC-VIEW)。構造化仕様を選んだ軸でグループへ分けて図にし、
 * グループごとに表示を切り替え、その状態のまま Tela 用ファイルへ書き出す。
 * 表示の切り替えは見る人の状態で、仕様そのものは変更しない。
 */
export function SpecVisualizationView({ pid }: { pid: string }): React.ReactElement {
  const [axis, setAxis] = React.useState<SpecViewAxis>('status');
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(new Set());
  const [exportError, setExportError] = React.useState('');
  const specsQ = useQuery({ queryKey: ['specs', pid], queryFn: () => api.listSpecs(pid) });
  const projectQ = useQuery({ queryKey: ['project', pid], queryFn: () => api.getProject(pid) });
  const versionQ = useQuery({ queryKey: ['spec-versions', pid, 0], queryFn: () => specVersionsApi.list(pid, 0) });

  const document = React.useMemo(() => specViewDocument(
    projectQ.data?.project.name ?? '', versionQ.data?.version ?? '0.0.0',
    (specsQ.data?.items ?? []).map(spec => ({
      code: spec.code, title: spec.title, status: spec.status,
      category: spec.category, priority: spec.priority, version: spec.version,
    })),
    axis, hidden,
  ), [projectQ.data, versionQ.data, specsQ.data, axis, hidden]);

  function toggle(id: string): void {
    setHidden(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
  function exportForTela(): void {
    try {
      downloadText('praeforma-spec-view.tela', telaSpecView(document));
      setExportError('');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Tela 用に書き出せませんでした。');
    }
  }

  if (specsQ.isPending || projectQ.isPending || versionQ.isPending) return <p>読み込み中…</p>;
  if (document.cards.length === 0) return <p>可視化できる仕様がまだありません。</p>;
  return <section className="spec-view">
    <p className="meta">
      {document.project} の仕様 {document.cards.length} 件 / バージョン {document.version}。
      グループの表示切り替えは見る人の状態で、仕様は変更しません。
    </p>
    <div className="simple-actions" aria-label="グループの軸">
      {AXES.map(([id, label]) => <button key={id} type="button" className={axis === id ? 'primary' : 'ghost'}
        aria-pressed={axis === id} onClick={() => { setAxis(id); setHidden(new Set()); }}>{label}</button>)}
    </div>
    <div className="simple-actions" aria-label="グループの表示">
      {document.groups.map(group => <button key={group.id} type="button" className={group.visible ? 'primary' : 'ghost'}
        aria-pressed={group.visible} onClick={() => toggle(group.id)}>
        {group.visible ? 'ON' : 'OFF'} {group.name}
      </button>)}
    </div>
    <SpecViewCanvas document={document} />
    <div className="simple-actions">
      <button type="button" onClick={exportForTela}>この図を Tela 用に書き出す</button>
    </div>
    {exportError ? <p role="alert" className="err-text">{exportError}</p> : null}
  </section>;
}
