import React from 'react';
import type { SceneMapScene } from '../../../../shared/project-home.ts';

const KIND_LABELS: Record<string, string> = { 'ui-2d': 'UI（2D）', 'world-2d': 'ワールド（2D）', 'world-3d': 'ワールド（3D）', screen: '画面' };

/** 遷移図の 1 シーン。シーンに置いた仕様と、行き先を読み取り専用で見せる。 */
export function SceneCard({ scene, onOpenSpec, onJump }: {
  scene: SceneMapScene; onOpenSpec: (code: string) => void; onJump: (layoutId: string) => void;
}): React.ReactElement {
  return <article className="scene-card" id={`scene-${scene.id}`} data-focus={scene.name}>
    <header className="scene-card-head">
      <strong>{scene.name}</strong>
      <span className="fragment-meta">
        <span>{KIND_LABELS[scene.kind] ?? scene.kind}</span>
        {scene.isDefault && <span className="role-badge">最初のシーン</span>}
        {scene.imported && <span className="role-badge">取り込み</span>}
        <span>入ってくる遷移 {scene.incomingCount}</span>
      </span>
    </header>
    {scene.description && <p className="fragment-content scene-card-desc">{scene.description}</p>}
    <div className="scene-card-section">
      <span className="scene-card-label">仕様 ({scene.specs.length})</span>
      {scene.specs.length === 0 ? <p className="meta">このシーンに置いた仕様はありません。</p>
        : <ul className="scene-spec-list">{scene.specs.map((spec) => <li key={spec.id}>
          <button type="button" className="link-button" onClick={() => onOpenSpec(spec.code)}>{spec.code}</button>
          {' '}{spec.title} <span className="role-badge">{spec.status}</span>
          {spec.via === 'actor' && <span className="meta"> (アクター経由)</span>}
        </li>)}</ul>}
    </div>
    <div className="scene-card-section">
      <span className="scene-card-label">行き先 ({scene.outgoing.length})</span>
      {scene.outgoing.length === 0 ? <p className="meta">このシーンから出る遷移はありません。</p>
        : <ul className="scene-spec-list">{scene.outgoing.map((t) => <li key={t.id}>
          → <button type="button" className="link-button" onClick={() => onJump(t.toLayoutId)}>{t.toName}</button>
          <span className="meta"> {t.label ?? t.trigger}{t.condition ? ` / 条件: ${t.condition}` : ''}</span>
        </li>)}</ul>}
    </div>
  </article>;
}
