/** PF-SPRINT input contracts. */
import { z } from 'zod';

const fragmentIds = z.array(z.string().min(1).max(64)).max(200);

export const createSprintSchema = z.object({
  title: z.string().trim().min(1).max(200),
  goal: z.string().max(2000).optional(),
  fragmentIds: fragmentIds.optional(),
}).strict();

export const addSprintFragmentsSchema = z.object({ fragmentIds: fragmentIds.min(1) }).strict();

/** PF-SPRINT-5: an absent body keeps the project-wide reconstruction. */
export const reconstructionScopeSchema = z.object({ sprintId: z.string().min(1).max(64) }).strict().nullable();

/** An empty body is the project-wide scope; malformed JSON fails validation instead of widening the scope. */
export function parseOptionalJson(raw: string): unknown {
  if (!raw.trim()) return null;
  try { return JSON.parse(raw) as unknown; } catch { return undefined; }
}
