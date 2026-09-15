import { z } from 'zod';

const id = z.string().trim().min(1).max(120);
export const MAX_LAYERS_PER_FRAME = 20;
export const MAX_SCENE_LAYERS = 200;

/**
 * Another scene's frame stacked over a frame of this scene. Array order is bottom to top.
 * Visibility is a viewer choice and is intentionally not part of the saved layer. PF-SCENE-8.
 */
export const sceneLayerSchema = z.object({ id, frameId: id, layoutId: id, layoutFrameId: id }).strict();
export type SceneLayer = z.infer<typeof sceneLayerSchema>;

export interface FrameSize { width: number; height: number }
export interface FrameFit { scale: number; offsetX: number; offsetY: number }

/** Layers keep their aspect ratio and are centered, so a different-sized frame is never stretched. */
export function fitFrame(source: FrameSize, target: FrameSize): FrameFit {
  const scale = Math.min(target.width / source.width, target.height / source.height);
  return { scale, offsetX: (target.width - source.width * scale) / 2, offsetY: (target.height - source.height * scale) / 2 };
}

export function layersForFrame(layers: readonly SceneLayer[], frameId: string): SceneLayer[] {
  return layers.filter(layer => layer.frameId === frameId);
}

/** Structural checks that need only this document; project membership is checked by the server. */
export function sceneLayerIssues(layers: readonly SceneLayer[], frameIds: ReadonlySet<string>): string[] {
  const issues: string[] = [];
  const ids = new Set<string>(); const targets = new Set<string>(); const perFrame = new Map<string, number>();
  for (const layer of layers) {
    if (ids.has(layer.id)) issues.push(`duplicate_scene_layer:${layer.id}`);
    ids.add(layer.id);
    if (!frameIds.has(layer.frameId)) issues.push(`unknown_scene_layer_frame:${layer.id}`);
    const target = JSON.stringify([layer.frameId, layer.layoutId, layer.layoutFrameId]);
    if (targets.has(target)) issues.push(`duplicate_scene_layer_target:${layer.id}`);
    targets.add(target);
    const count = (perFrame.get(layer.frameId) ?? 0) + 1;
    perFrame.set(layer.frameId, count);
    if (count === MAX_LAYERS_PER_FRAME + 1) issues.push(`too_many_scene_layers:${layer.frameId}`);
  }
  return issues;
}
