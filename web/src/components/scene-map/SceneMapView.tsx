import React from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScenePosition } from '../../../../shared/project-home.ts';
import { layoutScenes } from '../../../../shared/scene-map-layout.ts';
import { projectHomeApi } from '../../lib/project-home-api.ts';
import { FlowDiagram } from '../flow/FlowDiagram.tsx';
import { SceneProposals } from '../registration/SceneProposals.tsx';
import { SceneCard } from './SceneCard.tsx';
import { SceneMapCanvas } from './SceneMapCanvas.tsx';
import '../../styles/project-home.css';

/**
 * 遷移図 (spec/feature/scene-map.md)。シーンのキャプチャをキャンバスに並べ、遷移を矢印で結ぶ。
 * 基本は読み取り専用。「配置を編集」でノードを動かして位置を保存する (PF-MAP-10)。
 * ボタン配置と遷移の編集は ScreenFlow で行う (PF-MAP-12)。
 */
export function SceneMapView({ pid, onOpenSpec }: { pid: string; onOpenSpec: (code: string) => void }): React.ReactElement {
  const client = useQueryClient();
  const [importing, setImporting] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Map<string, ScenePosition>>(new Map());
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const query = useQuery({ queryKey: ['scene-map', pid], queryFn: () => projectHomeApi.sceneMap(pid) });
  const scenes = React.useMemo(() => query.data?.scenes ?? [], [query.data]);
  const base = React.useMemo(() => layoutScenes(scenes), [scenes]);
  const positions = React.useMemo(() => {
    if (!draft.size) return base;
    const merged = new Map(base);
    for (const [id, position] of draft) merged.set(id, position);
    return merged;
  }, [base, draft]);
  const save = useMutation({
    mutationFn: () => projectHomeApi.saveScenePositions(pid, {
      positions: scenes.map((scene) => ({ layoutId: scene.id, ...positions.get(scene.id)! })),
    }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['scene-map', pid] });
      setDraft(new Map()); setEditing(false);
    },
  });
  const cancel = (): void => { setDraft(new Map()); setEditing(false); save.reset(); };
  const selected = scenes.find((scene) => scene.id === selectedId) ?? null;

  return <section className="panel scene-map" aria-labelledby="scene-map-title">
    <div className="home-head">
      <div className="pf-scene-title">
        <span className="pf-scene-mode">{editing ? '配置を編集中' : '読み取り専用'}</span>
        <h3 id="scene-map-title">遷移図{query.isSuccess && ` (シーン ${scenes.length})`}</h3>
      </div>
      <div className="simple-actions">
        {editing ? <>
          <button type="button" className="primary" disabled={save.isPending || scenes.length === 0} onClick={() => save.mutate()}>
            {save.isPending ? '保存中…' : '配置を保存'}</button>
          <button type="button" className="ghost" disabled={save.isPending} onClick={cancel}>やめる</button>
        </> : <>
          {query.data?.canEdit && scenes.length > 0 && <button type="button" className="ghost" onClick={() => setEditing(true)}>配置を編集</button>}
          <button type="button" className="ghost" aria-expanded={importing} onClick={() => setImporting((v) => !v)}>
            {importing ? '取り込みを閉じる' : '既存シーンを取り込む'}</button>
          <Link to={`/projects/${pid}/flow`} className="ghost" style={{ textDecoration: 'none' }}>ボタン配置を編集</Link>
        </>}
      </div>
    </div>
    {editing && <p className="meta">シーンをドラッグして動かし、「配置を保存」で保存します。背景のドラッグで画面を動かせます。</p>}
    {save.isError && <p role="alert">配置を保存できませんでした。動かした位置は残っています。もう一度保存してください。</p>}
    {importing && !editing && <div className="scene-map-import">
      <SceneProposals pid={pid} onRegistered={() => { void client.invalidateQueries({ queryKey: ['scene-map', pid] }); }} />
    </div>}
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">遷移図を取得できませんでした。<button type="button" onClick={() => { void query.refetch(); }}>再取得</button></p>}
    {query.isSuccess && scenes.length === 0 && <p>シーンはまだありません。「既存シーンを取り込む」で解析済みのシーンを登録できます。</p>}
    {query.isSuccess && scenes.length > 0 && <div className="scene-map-stage" data-has-detail={selected ? 'true' : undefined}>
      <SceneMapCanvas pid={pid} scenes={scenes} positions={positions} editing={editing} selectedId={selectedId}
        onSelect={setSelectedId} onMove={(id, position) => setDraft((current) => new Map(current).set(id, position))} />
      {selected && <aside className="scene-map-detail" aria-label={`${selected.name} の詳細`}>
        <button type="button" className="ghost scene-map-detail-close" onClick={() => setSelectedId(null)}>閉じる</button>
        <SceneCard scene={selected} onOpenSpec={onOpenSpec} onJump={setSelectedId} />
        <Link to={`/projects/${pid}/layouts/${selected.id}`}>このシーンをシーンエディタで開く</Link>
      </aside>}
    </div>}
    {query.isSuccess && query.data.unplacedSpecs.length > 0 && <details className="scene-map-unplaced">
      <summary>どのシーンにも置いていない仕様 ({query.data.unplacedSpecs.length})</summary>
      <ul className="scene-spec-list">{query.data.unplacedSpecs.map((spec) => <li key={spec.id}>
        <button type="button" className="link-button" onClick={() => onOpenSpec(spec.code)}>{spec.code}</button> {spec.title}
      </li>)}</ul>
    </details>}
    <details className="scene-map-overview">
      <summary>全体の流れ図 (文字)</summary>
      <FlowDiagram pid={pid} revision={query.dataUpdatedAt} />
    </details>
  </section>;
}
