import { req } from './api.ts';

export interface ProjectUxGoal {
  experience: string;
  design: string;
  goal: string;
  /** ストーリー (カスタマージャーニー)。 PF-GOAL-W2 */
  story: string;
  /** かかわる感情の定義。 PF-GOAL-W2 */
  emotions: string;
  revision: number;
}

export function getProjectUxGoal(pid: string): Promise<{ definition: ProjectUxGoal }> {
  return req(`/api/projects/${encodeURIComponent(pid)}/ux-goal`);
}

export function saveProjectUxGoal(pid: string, definition: ProjectUxGoal): Promise<{ definition: ProjectUxGoal }> {
  const { revision, ...text } = definition;
  return req(`/api/projects/${encodeURIComponent(pid)}/ux-goal`, {
    method: 'PUT', body: JSON.stringify({ ...text, expectedRevision: revision }),
  });
}
