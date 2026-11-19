// 遷移図キャンバスの位置とキャプチャの読み書き (spec/feature/scene-map.md PF-MAP-7 / PF-MAP-10)。
// 位置は scene_map_positions (spec/schema/scene-map-positions.md)、キャプチャはシーンエディタの取り込み資料から読む。

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, getLocalSqlite } from '../db/connection.ts';
import { layouts } from '../db/schema/layout.ts';
import { sceneDocuments } from '../db/schema/scene-editor.ts';
import { versionBatch, versionRows } from '../db/spec-version-store.ts';
import type { ScenePosition } from '../../../shared/project-home.ts';
import type { ScenePositionsInput } from '../../../shared/scene-map-layout.ts';
import { pickCapture, type SceneCapture } from './scene-capture.ts';
import { AppError } from './errors.ts';

export async function readScenePositions(projectId: string): Promise<Map<string, ScenePosition>> {
  const rows = await versionRows('SELECT layout_id,x,y FROM scene_map_positions WHERE project_id=?', [projectId]);
  return new Map(rows.map((row) => [String(row.layout_id), { x: Number(row.x), y: Number(row.y) }]));
}

/** プロジェクトに無いシーン (削除済みを含む) が 1 件でも混ざれば何も保存しない。 */
export async function saveScenePositions(projectId: string, input: ScenePositionsInput, userId: string): Promise<number> {
  const ids = input.positions.map((p) => p.layoutId);
  const found = await getDb().select({ id: layouts.id }).from(layouts)
    .where(and(eq(layouts.projectId, projectId), isNull(layouts.deletedAt), inArray(layouts.id, ids)));
  if (found.length !== new Set(ids).size) throw AppError.badRequest('unknown_scene');
  const at = new Date().toISOString();
  await versionBatch(input.positions.map((p) => ({
    sql: `INSERT INTO scene_map_positions(layout_id,project_id,x,y,updated_by,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(layout_id) DO UPDATE SET x=excluded.x,y=excluded.y,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
    args: [p.layoutId, projectId, p.x, p.y, userId, at],
  })));
  return input.positions.length;
}

/**
 * キャプチャ (画像付きの取り込み資料) を持つシーン。画像そのものは読まない。
 * versionRows は ? を引数の記号に置き換えるので、PostgreSQL 側も ? を含まない式で書く。
 */
export async function readCaptureLayouts(projectId: string): Promise<Set<string>> {
  const sql = getLocalSqlite()
    ? `SELECT layout_id FROM scene_documents WHERE project_id=? AND instr(payload,'"image":"data:image/')>0`
    : `SELECT layout_id FROM scene_documents WHERE project_id=? AND EXISTS (SELECT 1 FROM jsonb_array_elements(payload->'sources') s WHERE jsonb_typeof(s->'image')='string')`;
  const rows = await versionRows(sql, [projectId]);
  return new Set(rows.map((row) => String(row.layout_id)));
}

export async function readSceneCapture(projectId: string, layoutId: string): Promise<SceneCapture | null> {
  const [row] = await getDb().select({ payload: sceneDocuments.payload }).from(sceneDocuments)
    .where(and(eq(sceneDocuments.layoutId, layoutId), eq(sceneDocuments.projectId, projectId))).limit(1);
  return row ? pickCapture(row.payload) : null;
}
