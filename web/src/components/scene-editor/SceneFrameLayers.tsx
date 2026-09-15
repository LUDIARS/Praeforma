import React from 'react';
import { fitFrame, type FrameSize, type SceneLayer } from '../../../../shared/scene-layers.ts';
import type { LayerSceneSource } from './useSceneLayerSources.ts';

interface Props {
  base: FrameSize;
  layers: readonly SceneLayer[];
  sources: ReadonlyMap<string, LayerSceneSource>;
  hidden: ReadonlySet<string>;
}

/** Layered scenes are drawn read-only above the base frame and never take pointer input. PF-SCENE-8. */
export function SceneFrameLayers({ base, layers, sources, hidden }: Props): React.ReactElement | null {
  const visible = layers.filter(layer => !hidden.has(layer.layoutId));
  if (!visible.length) return null;
  return <div className="scene-frame-layers" aria-label="重ねたシーン">{visible.map(layer => {
    const document = sources.get(layer.layoutId)?.document;
    const frame = document?.canvas.frames.find(item => item.id === layer.layoutFrameId);
    if (!document || !frame) return null;
    const fit = fitFrame(frame, base);
    return <div key={layer.id} className="scene-frame-layer">
      {document.canvas.elements.filter(element => element.frame_id === frame.id).map(element => (
        <div key={element.id} className={`ux-element ${element.kind} scene-layer-element`} style={{
          left: fit.offsetX + element.x * fit.scale, top: fit.offsetY + element.y * fit.scale,
          width: element.width * fit.scale, height: element.height * fit.scale,
        }}><span>{element.sample_text ?? element.label}</span></div>
      ))}
    </div>;
  })}</div>;
}
