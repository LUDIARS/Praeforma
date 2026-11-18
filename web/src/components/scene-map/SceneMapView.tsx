import React from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectHomeApi } from '../../lib/project-home-api.ts';
import { FlowDiagram } from '../flow/FlowDiagram.tsx';
import { SceneProposals } from '../registration/SceneProposals.tsx';
import { SceneCard } from './SceneCard.tsx';
import '../../styles/project-home.css';

/**
 * 遷移図 (spec/feature/scene-map.md)。シーンを主役に並べ、各シーンに置いた仕様と行き先を見せる。
 * 基本は読み取り専用。ボタン配置などの編集は「編集モード」(ScreenFlow) で行う。
 */
export function SceneMapView({ pid, onOpenSpec }: { pid: string; onOpenSpec: (code: string) => void }): React.ReactElement {
  const client = useQueryClient();
  const [importing, setImporting] = React.useState(false);
  const query = useQuery({ queryKey: ['scene-map', pid], queryFn: () => projectHomeApi.sceneMap(pid) });
  const jump = (layoutId: string): void => {
    document.getElementById(`scene-${layoutId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return <section className="panel scene-map" aria-labelledby="scene-map-title">
    <div className="home-head">
      <div className="pf-scene-title"><span className="pf-scene-mode">読み取り専用</span><h3 id="scene-map-title">遷移図{query.isSuccess && ` (シーン ${query.data.scenes.length})`}</h3></div>
      <div className="simple-actions">
        <button type="button" className="ghost" aria-expanded={importing} onClick={() => setImporting((v) => !v)}>
          {importing ? '取り込みを閉じる' : '既存シーンを取り込む'}</button>
        <Link to={`/projects/${pid}/flow`} className="primary" style={{ textDecoration: 'none' }}>編集モード</Link>
      </div>
    </div>
    {importing && <div className="scene-map-import">
      <SceneProposals pid={pid} onRegistered={() => { void client.invalidateQueries({ queryKey: ['scene-map', pid] }); }} />
    </div>}
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">遷移図を取得できませんでした。<button type="button" onClick={() => { void query.refetch(); }}>再取得</button></p>}
    {query.isSuccess && query.data.scenes.length === 0 && <p>シーンはまだありません。「既存シーンを取り込む」で解析済みのシーンを登録できます。</p>}
    {query.isSuccess && query.data.scenes.length > 0 && <div className="scene-grid">
      {query.data.scenes.map((scene) => <SceneCard key={scene.id} scene={scene} onOpenSpec={onOpenSpec} onJump={jump} />)}
    </div>}
    {query.isSuccess && query.data.unplacedSpecs.length > 0 && <details className="scene-map-unplaced">
      <summary>どのシーンにも置いていない仕様 ({query.data.unplacedSpecs.length})</summary>
      <ul className="scene-spec-list">{query.data.unplacedSpecs.map((spec) => <li key={spec.id}>
        <button type="button" className="link-button" onClick={() => onOpenSpec(spec.code)}>{spec.code}</button> {spec.title}
      </li>)}</ul>
    </details>}
    <details className="scene-map-overview">
      <summary>全体の流れ図</summary>
      <FlowDiagram pid={pid} revision={query.dataUpdatedAt} />
    </details>
  </section>;
}
