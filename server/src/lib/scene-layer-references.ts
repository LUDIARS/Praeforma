import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { layouts } from '../db/schema/layout.ts';
import type { SceneLayer } from '../../../shared/scene-layers.ts';
import { AppError } from './errors.ts';

/**
 * Layers may point only at other scenes of the same project. A scene soft-deleted after being
 * layered stays referable, so the base scene remains savable and the editor marks it missing.
 * PF-SCENE-8.
 */
export async function assertSceneLayerReferences(projectId: string, layoutId: string, layers: readonly SceneLayer[]): Promise<void> {
  const referenced = [...new Set(layers.map(layer => layer.layoutId))];
  if (referenced.includes(layoutId)) throw AppError.badRequest('scene_layer_self_reference');
  if (!referenced.length) return;
  const rows = await getDb().select({ id: layouts.id }).from(layouts)
    .where(and(eq(layouts.projectId, projectId), inArray(layouts.id, referenced)));
  const known = new Set(rows.map(row => row.id));
  const unknown = referenced.filter(id => !known.has(id));
  if (unknown.length) throw AppError.badRequest('unknown_scene_layer_layout', { layoutIds: unknown });
}
