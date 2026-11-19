// 遷移図キャンバスの配置 (spec/feature/scene-map.md PF-MAP-8 / PF-MAP-10 / PF-MAP-11)。
// server (位置の保存入力の検証) と web (自動配置・矢印のまとめ) が共有する純関数。

import { z } from 'zod';
import type { SceneMapScene, ScenePosition } from './project-home.ts';

/** ノードの大きさ。キャプチャは 16:10 で収める。 */
export const SCENE_NODE_WIDTH = 240;
export const SCENE_NODE_HEIGHT = 210;
const COLUMN_GAP = 120;
const ROW_GAP = 60;
const ORIGIN = 40;
export const MAX_SCENE_POSITIONS = 500;

const coordinate = z.number().finite().min(-100_000).max(100_000);
export const scenePositionsSchema = z.object({
  positions: z.array(z.object({
    layoutId: z.string().trim().min(1).max(120), x: coordinate, y: coordinate,
  }).strict()).min(1).max(MAX_SCENE_POSITIONS),
}).strict().superRefine((value, ctx) => {
  const ids = new Set(value.positions.map((p) => p.layoutId));
  if (ids.size !== value.positions.length) ctx.addIssue({ code: 'custom', message: 'duplicate_layout_id' });
});
export type ScenePositionsInput = z.infer<typeof scenePositionsSchema>;

/**
 * 保存した位置が無いシーンを自動で置く。最初のシーンから遷移をたどった深さを列、
 * 列の中で出てきた順を行にする。どこからもたどれないシーンは最後の列の右へ並べる。
 * 保存済みの位置はそのまま使い、自動配置は保存済みのノードの下へずらして重ならないようにする。
 */
export function layoutScenes(scenes: readonly SceneMapScene[]): Map<string, ScenePosition> {
  const result = new Map<string, ScenePosition>();
  for (const scene of scenes) if (scene.position) result.set(scene.id, scene.position);
  const pending = scenes.filter((scene) => !scene.position);
  if (!pending.length) return result;

  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const depth = new Map<string, number>();
  const roots = scenes.filter((scene) => scene.isDefault);
  const queue = (roots.length ? roots : scenes.filter((scene) => scene.incomingCount === 0).slice(0, 1)).map((scene) => scene.id);
  for (const id of queue) depth.set(id, 0);
  for (let index = 0; index < queue.length; index++) {
    const current = byId.get(queue[index]!)!;
    for (const transition of current.outgoing) {
      if (depth.has(transition.toLayoutId) || !byId.has(transition.toLayoutId)) continue;
      depth.set(transition.toLayoutId, depth.get(current.id)! + 1);
      queue.push(transition.toLayoutId);
    }
  }
  const lastColumn = depth.size ? Math.max(...depth.values()) + 1 : 0;
  const top = result.size ? Math.max(...[...result.values()].map((p) => p.y)) + SCENE_NODE_HEIGHT + ROW_GAP : ORIGIN;
  const rows = new Map<number, number>();
  const order = new Map(queue.map((id, index) => [id, index]));
  const sorted = [...pending].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
  for (const scene of sorted) {
    const column = depth.get(scene.id) ?? lastColumn;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    result.set(scene.id, {
      x: ORIGIN + column * (SCENE_NODE_WIDTH + COLUMN_GAP),
      y: top + row * (SCENE_NODE_HEIGHT + ROW_GAP),
    });
  }
  return result;
}

export interface SceneEdge { id: string; from: string; to: string; label: string; count: number }

/** 同じ 2 シーン間 (向き付き) の遷移を 1 本にまとめる。ラベルは先頭の遷移のもの。 */
export function sceneEdges(scenes: readonly SceneMapScene[]): SceneEdge[] {
  const edges = new Map<string, SceneEdge>();
  for (const scene of scenes) {
    for (const transition of scene.outgoing) {
      const key = `${scene.id}->${transition.toLayoutId}`;
      const edge = edges.get(key);
      if (edge) edge.count += 1;
      else edges.set(key, { id: key, from: scene.id, to: transition.toLayoutId, label: transition.label ?? transition.trigger, count: 1 });
    }
  }
  return [...edges.values()];
}
