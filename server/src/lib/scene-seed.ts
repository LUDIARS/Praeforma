import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { layoutObjects } from '../db/schema/layout.ts';
import { objects } from '../db/schema/object.ts';
import type { SceneDocument } from '../../../shared/scene-editor.ts';

function partKind(shape:string):SceneDocument['canvas']['elements'][number]['kind'] {
  if(shape==='button'||shape==='linked-button'||shape==='draft-button'||shape==='toggle')return 'button';
  if(shape==='text'||shape==='input'||shape==='image')return shape;
  return shape==='listbox'?'list':'box';
}

/** 旧配置は3D世界座標なので、キャンバス契約 (design-canvas.ts) の範囲へ収める。 */
const clampPosition = (value:number):number => Number.isFinite(value) ? Math.min(100_000, Math.max(-100_000, value)) : 0;
const clampSize = (value:number):number => Number.isFinite(value) ? Math.min(100_000, Math.max(1, Math.abs(value))) : 1;

/** Read-only inheritance of legacy placement data. PF-SCENE-1. */
export async function seedScene(projectId: string, layoutId: string, name: string): Promise<SceneDocument> {
  const rows = await getDb().select({ placement: layoutObjects, object: objects }).from(layoutObjects)
    .innerJoin(objects, and(eq(objects.id, layoutObjects.objectId), eq(objects.projectId, projectId)))
    .where(eq(layoutObjects.layoutId, layoutId)).orderBy(asc(layoutObjects.ordinal)).limit(5000);
  const frameId = 'legacy-frame';
  return { sources: [], canvas: { revision: 0,
    frames: [{ id: frameId, name: name.trim().slice(0, 200) || 'シーン', description: '既存シーン配置から引き継いだ画面', states: [], x: 40, y: 70, width: 1280, height: 720, viewport: { width: 1280, height: 720 } }],
    elements: rows.map(({ placement, object }) => ({ id: placement.id, frame_id: frameId, kind: partKind(object.placeholderShape), label: object.label.trim().slice(0, 300) || '名称未設定',
      x: clampPosition(placement.position[0] ?? 0), y: clampPosition(placement.position[1] ?? 0),
      width: clampSize((placement.scale[0] ?? 1) * 80), height: clampSize((placement.scale[1] ?? 1) * 80),
      sample_text: null, dynamic: { enabled: false, source: object.id, update_condition: null }, follow: null })), transitions: [] } };
}
