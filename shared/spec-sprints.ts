/** PF-SPRINT: a check unit that groups fragments until they are structured together. */
import type { SpecFragment } from './spec-fragments.ts';

export type SprintStage = 'empty' | 'checking' | 'ready' | 'structured';

export interface SprintCounts {
  total: number;
  implemented: number;
  unimplemented: number;
  unverified: number;
  reconstructed: number;
  /** Not yet structured fragments that are still not implemented. */
  pendingNotImplemented: number;
}

export interface SpecSprint {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  createdBy: string;
  createdAt: string;
  counts: SprintCounts;
  stage: SprintStage;
}

export interface SprintFragment extends SpecFragment { reconstructed: boolean }

export interface SprintInput { title: string; goal?: string; fragmentIds?: string[] }

/** PF-SPRINT-4: the stage is derived on every read and never stored. */
export function sprintStage(counts: SprintCounts): SprintStage {
  if (counts.total === 0) return 'empty';
  const pending = counts.total - counts.reconstructed;
  if (pending === 0) return 'structured';
  return counts.pendingNotImplemented === 0 ? 'ready' : 'checking';
}

export const SPRINT_STAGE_LABELS: Record<SprintStage, string> = {
  empty: '断片なし', checking: '確認中', ready: 'まとまった', structured: '体系化済',
};
