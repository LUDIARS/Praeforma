import type { DesignCanvasDocument } from '../../../../shared/design-canvas.ts';
import { layersForFrame, type SceneLayer } from '../../../../shared/scene-layers.ts';
import { telaSceneOverlay, type TelaOverlayScene } from '../../../../shared/tela-scene-overlay-export.ts';
import type { LayerSceneSource } from './useSceneLayerSources.ts';

interface Input {
  lid: string;
  sceneName: string;
  canvas: DesignCanvasDocument;
  frameId: string;
  layers: readonly SceneLayer[];
  sources: ReadonlyMap<string, LayerSceneSource>;
  hidden: ReadonlySet<string>;
}

/**
 * Resolves one frame and its layers into the Tela overlay file. A layer that is not loaded or whose
 * frame is gone stops the export: silently dropping it would hand Tela an incomplete scene.
 */
export function telaOverlayForFrame(input: Input): string {
  const frame = input.canvas.frames.find(item => item.id === input.frameId);
  if (!frame) throw new Error('書き出す画面が見つかりません。');
  const base: TelaOverlayScene = {
    id: input.lid, name: input.sceneName, visible: !input.hidden.has(input.lid),
    frame, elements: input.canvas.elements.filter(element => element.frame_id === frame.id),
  };
  const layers = layersForFrame(input.layers, frame.id).map((layer): TelaOverlayScene => {
    const source = input.sources.get(layer.layoutId);
    const layered = source?.document?.canvas.frames.find(item => item.id === layer.layoutFrameId);
    if (!source?.document || !layered) throw new Error('読み込めていない、または画面が見つからない重ねたシーンがあるため書き出せません。');
    return {
      id: layer.id, name: `${source.name ?? layer.layoutId} / ${layered.name}`, visible: !input.hidden.has(layer.layoutId),
      frame: layered, elements: source.document.canvas.elements.filter(element => element.frame_id === layered.id),
    };
  });
  return telaSceneOverlay(base, layers);
}
