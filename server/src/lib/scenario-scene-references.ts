import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { layouts } from '../db/schema/layout.ts';
import type { CanvasFrame } from '../db/schema/ux-design.ts';
import { AppError } from './errors.ts';

/** Existing references survive a scene's deletion; cross-project references never enter storage. */
export async function assertScenarioSceneReferences(projectId: string, frames: readonly CanvasFrame[]): Promise<void> {
  const ids = [...new Set(frames.flatMap(frame => frame.scene_ref ? [frame.scene_ref.layout_id] : []))];
  if (!ids.length) return;
  const rows = await getDb().select({ id: layouts.id }).from(layouts)
    .where(and(eq(layouts.projectId, projectId), inArray(layouts.id, ids)));
  const known = new Set(rows.map(row => row.id));
  if (ids.some(id => !known.has(id))) throw AppError.badRequest('scenario_scene_not_in_project');
}
