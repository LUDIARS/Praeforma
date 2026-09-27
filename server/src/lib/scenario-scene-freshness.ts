import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { layouts } from '../db/schema/layout.ts';
import { sceneDocuments } from '../db/schema/scene-editor.ts';
import type { CanvasFrame } from '../db/schema/ux-design.ts';

/** Evidence cannot stay current after a referenced base scene changes or disappears. */
export async function scenarioScenesCurrent(projectId: string, frames: readonly CanvasFrame[]): Promise<boolean> {
  const references = frames.flatMap(frame => frame.scene_ref ? [frame.scene_ref] : []);
  if (!references.length) return true;
  const rows = await getDb().select({ id: layouts.id, deletedAt: layouts.deletedAt, revision: sceneDocuments.revision, payload: sceneDocuments.payload })
    .from(layouts).leftJoin(sceneDocuments, and(eq(sceneDocuments.layoutId, layouts.id), eq(sceneDocuments.projectId, projectId)))
    .where(and(eq(layouts.projectId, projectId), inArray(layouts.id, [...new Set(references.map(ref => ref.layout_id))])));
  return references.every(ref => {
    const row = rows.find(item => item.id === ref.layout_id);
    return row !== undefined && row.deletedAt === null && ref.revision === (row.revision ?? 0)
      && (row.payload ? row.payload.canvas.frames.some(frame => frame.id === ref.frame_id) : ref.frame_id === 'legacy-frame');
  });
}
