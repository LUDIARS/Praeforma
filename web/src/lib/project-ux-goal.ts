import { req } from './api.ts';
import type { CatchcopyOrigin } from '../../../shared/catchcopy.ts';

export interface ProjectUxGoal {
  experience: string;
  design: string;
  goal: string;
  /** ストーリー (カスタマージャーニー)。 PF-GOAL-W2 */
  story: string;
  /** かかわる感情の定義。 PF-GOAL-W2 */
  emotions: string;
  /** キャッチコピー (人が考えた文言が正本)。 PF-GOAL-W3 */
  catchcopy: string;
  /** サーバが決める。 '' / 'human' / 'ai' (AI案)。送らない。 */
  catchcopyOrigin: CatchcopyOrigin;
  /** ターゲットユーザー。 PF-GOAL-W4 */
  target: string;
  revision: number;
}

export function getProjectUxGoal(pid: string): Promise<{ definition: ProjectUxGoal }> {
  return req(`/api/projects/${encodeURIComponent(pid)}/ux-goal`);
}

export function saveProjectUxGoal(pid: string, definition: ProjectUxGoal): Promise<{ definition: ProjectUxGoal }> {
  const { revision, catchcopyOrigin: _origin, ...text } = definition;
  return req(`/api/projects/${encodeURIComponent(pid)}/ux-goal`, {
    method: 'PUT', body: JSON.stringify({ ...text, expectedRevision: revision }),
  });
}
