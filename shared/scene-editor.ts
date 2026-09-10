import { z } from 'zod';
import { canvasSchema, type DesignCanvasDocument } from './design-canvas.ts';
import { webSceneSchema, type WebScene } from './web-scene.ts';

const id = z.string().trim().min(1).max(120);
const size = z.number().finite().positive().max(100_000);
export const runtimeSnapshotSchema = z.object({
  version: z.literal(1), source: z.string().trim().min(1).max(500), capturedAt: z.string().datetime({ offset: true }),
  viewport: z.object({ width: size, height: size }).strict(),
  nodes: z.array(z.object({
    id, parentId: id.nullable(), label: z.string().trim().min(1).max(300),
    kind: z.enum(['box', 'text', 'button', 'input', 'image', 'list']),
    bounds: z.object({ x: z.number().finite().min(0).max(100_000), y: z.number().finite().min(0).max(100_000), width: size, height: size }).strict(),
    ontologyRef: z.string().max(500).nullable(), sampleText: z.string().max(2000).nullable(),
  }).strict()).min(1).max(200),
}).strict().superRefine((value, ctx) => {
  const nodes = new Map(value.nodes.map(node => [node.id, node]));
  if (nodes.size !== value.nodes.length) ctx.addIssue({ code: 'custom', message: 'duplicate_node_id' });
  for (const node of value.nodes) {
    if (node.parentId && !nodes.has(node.parentId)) ctx.addIssue({ code: 'custom', message: 'unknown_parent' });
    const seen = new Set([node.id]); let parent = node.parentId;
    while (parent) {
      if (seen.has(parent)) { ctx.addIssue({ code: 'custom', message: 'node_cycle' }); break; }
      seen.add(parent); parent = nodes.get(parent)?.parentId ?? null;
    }
  }
});
export type RuntimeSnapshot = z.infer<typeof runtimeSnapshotSchema>;
export const sceneSourceSchema = z.object({
  id, frameId: id, fingerprint: z.string().max(100).nullable(),
  image: z.string().max(3_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/).nullable(),
  runtime: runtimeSnapshotSchema.nullable(), notes: z.array(z.string().max(1000)).max(50),
}).strict();
export type SceneSource = z.infer<typeof sceneSourceSchema>;
export interface SceneDocument { canvas: DesignCanvasDocument; sources: SceneSource[]; web?: WebScene }
export const sceneSaveSchema = z.object({
  canvas: canvasSchema, sources: z.array(sceneSourceSchema).max(20), web: webSceneSchema.optional(),
}).strict().superRefine((value, ctx) => {
  const frames = new Set(value.canvas.frames.map(frame => frame.id));
  const sources = new Set(value.sources.map(source => source.id));
  if (value.web?.variants.some(variant => !frames.has(variant.frameId))) ctx.addIssue({ code: 'custom', message: 'unknown_web_frame' });
  if (sources.size !== value.sources.length || value.sources.some(source => !frames.has(source.frameId))) {
    ctx.addIssue({ code: 'custom', message: 'invalid_source_reference' });
  }
});

/** Runtime coordinates are observations, not generated estimates. PF-SCENE-3. */
export function canvasFromRuntime(runtime: RuntimeSnapshot, frameId: string): DesignCanvasDocument {
  return { revision: 0, frames: [{ id: frameId, name: runtime.source.slice(0,200), description: `観測日時: ${runtime.capturedAt}`, states: [], x: 40, y: 70,
    width: runtime.viewport.width, height: runtime.viewport.height, viewport: runtime.viewport }],
  elements: runtime.nodes.map((node, index) => ({ id: `${frameId}-${index}`, frame_id: frameId, kind: node.kind, label: node.label,
    ...node.bounds, sample_text: node.sampleText, dynamic: { enabled: true, source: node.id, update_condition: null }, follow: null })), transitions: [] };
}
