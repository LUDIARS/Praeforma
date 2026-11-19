import { getToken, req, type ApiError } from './api.ts';
import type { ProjectEvent, SceneMap } from '../../../shared/project-home.ts';
import type { ScenePositionsInput } from '../../../shared/scene-map-layout.ts';

const base = (pid: string): string => `/api/projects/${encodeURIComponent(pid)}`;

/** ダッシュボードの最近の出来事と、遷移図 (シーン中心) の取得・配置の保存。 */
export const projectHomeApi = {
  events: (pid: string, limit = 30) => req<{ items: ProjectEvent[]; limit: number }>(`${base(pid)}/events?limit=${limit}`),
  sceneMap: (pid: string) => req<SceneMap>(`${base(pid)}/scene-map`),
  /** キャンバス上の位置だけを保存する (PF-MAP-10)。 */
  saveScenePositions: (pid: string, input: ScenePositionsInput) => req<{ saved: number }>(
    `${base(pid)}/scene-map/positions`, { method: 'PUT', body: JSON.stringify(input) }),
  /** シーンのキャプチャ画像 (PF-MAP-7)。Bearer を付けるため <img src> ではなく fetch で取る。 */
  sceneCapture: async (pid: string, lid: string): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${base(pid)}/scene-map/scenes/${encodeURIComponent(lid)}/capture`, {
      headers: token ? { authorization: `Bearer ${token}` } : {}, cache: 'no-store',
    });
    if (!res.ok) { const err = new Error(`HTTP ${res.status}`) as ApiError; err.status = res.status; throw err; }
    return res.blob();
  },
};
