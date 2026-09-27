import React from 'react';
import type { CanvasFrame } from '../../lib/ux-design-api.ts';
import { useSceneLayerSources } from '../scene-editor/useSceneLayerSources.ts';
import { fitFrame } from '../../../../shared/scene-layers.ts';
import { webPreview } from '../../../../shared/web-scene-export.ts';

/** A read-only view of the scene; scenario editing never mutates or duplicates its basic parts. */
export function ScenarioBaseFrame({ projectId, frame }: { projectId: string; frame: CanvasFrame }): React.ReactElement | null {
  const ref = frame.scene_ref;
  const layers = ref ? [{ id: frame.id, frameId: frame.id, layoutId: ref.layout_id, layoutFrameId: ref.frame_id }] : [];
  const sources = useSceneLayerSources(projectId, layers);
  if (!ref) return null;
  const source = sources.get(ref.layout_id);
  const base = source?.document?.canvas.frames.find(item => item.id === ref.frame_id);
  if (!base) return <div className="ux-base-scene">{source?.isLoading ? '基本シーンを読み込み中…' : '基本シーンを表示できません'}</div>;
  const fit = fitFrame(base, frame);
  if (source?.document?.web?.variants.some(variant => variant.frameId === base.id)) return <div className="ux-base-scene" aria-label="シーンの基本構成"><iframe title={`${base.name} の基本構成`} tabIndex={-1} sandbox="" srcDoc={webPreview(source.document.web, base.id)} style={{ position: 'absolute', left: fit.offsetX, top: fit.offsetY, width: base.width, height: base.height, border: 0, transform: `scale(${fit.scale})`, transformOrigin: 'top left', background: 'white' }} /></div>;
  return <div className="ux-base-scene" aria-label="シーンの基本構成">{source?.document?.canvas.elements.filter(item => item.frame_id === base.id).map(item => <div className={`ux-element ${item.kind}`} key={item.id} style={{ left: fit.offsetX + item.x * fit.scale, top: fit.offsetY + item.y * fit.scale, width: item.width * fit.scale, height: item.height * fit.scale }}><span>{item.sample_text ?? item.label}</span></div>)}</div>;
}
