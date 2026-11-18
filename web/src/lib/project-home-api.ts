import { req } from './api.ts';
import type { ProjectEvent, SceneMap } from '../../../shared/project-home.ts';

/** ダッシュボードの最近の出来事と、遷移図 (シーン中心) の取得。どちらも読み取り専用。 */
export const projectHomeApi = {
  events: (pid: string, limit = 30) => req<{ items: ProjectEvent[]; limit: number }>(
    `/api/projects/${encodeURIComponent(pid)}/events?limit=${limit}`),
  sceneMap: (pid: string) => req<SceneMap>(`/api/projects/${encodeURIComponent(pid)}/scene-map`),
};
