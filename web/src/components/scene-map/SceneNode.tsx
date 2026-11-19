import React from 'react';
import type { SceneMapScene, ScenePosition } from '../../../../shared/project-home.ts';
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH } from '../../../../shared/scene-map-layout.ts';
import { useSceneCapture } from './useSceneCapture.ts';

const KIND_LABELS: Record<string, string> = { 'ui-2d': 'UI（2D）', 'world-2d': 'ワールド（2D）', 'world-3d': 'ワールド（3D）', screen: '画面' };

/** キャンバス上の 1 シーン (PF-MAP-7)。キャプチャ・名前・種類・仕様の件数を出す。 */
export function SceneNode({ pid, scene, position, selected, editing, onPointerDown, onSelect }: {
  pid: string; scene: SceneMapScene; position: ScenePosition; selected: boolean; editing: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void; onSelect: () => void;
}): React.ReactElement {
  const capture = useSceneCapture(pid, scene.id, scene.hasCapture);
  return <div className="scene-node" role="button" tabIndex={0} aria-pressed={selected}
    aria-label={`${scene.name}${scene.isDefault ? '（最初のシーン）' : ''}`} data-editing={editing || undefined}
    style={{ left: position.x, top: position.y, width: SCENE_NODE_WIDTH, height: SCENE_NODE_HEIGHT }}
    onPointerDown={onPointerDown}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); } }}>
    <div className="scene-node-capture">
      {capture ? <img src={capture} alt={`${scene.name} のキャプチャ`} draggable={false} />
        : <span className="meta">{scene.hasCapture ? '読み込み中…' : 'キャプチャなし'}</span>}
    </div>
    <div className="scene-node-body">
      <strong className="scene-node-name">{scene.name}</strong>
      <span className="scene-node-meta">
        <span>{KIND_LABELS[scene.kind] ?? scene.kind}</span>
        <span>仕様 {scene.specs.length}</span>
        {scene.isDefault && <span className="role-badge">最初</span>}
        {scene.imported && <span className="role-badge">取り込み</span>}
      </span>
    </div>
  </div>;
}
