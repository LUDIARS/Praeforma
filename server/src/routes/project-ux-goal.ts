// /api/projects/:pid/ux-goal — プロジェクト最上位の UX/Goal (spec/feature/project-ux-goal.md)。
//
// role:
//   - get: viewer 以上 (プロジェクトメンバー)
//   - put: owner / planner / designer
// PF-GOAL-INV1 (プロジェクト単位で分離) / PF-GOAL-INV2 (版不一致は 409 で上書きしない)。

import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';

const inputSchema = z.object({
  experience: z.string().max(20_000),
  design: z.string().max(20_000),
  goal: z.string().max(20_000),
  expectedRevision: z.number().int().min(0).max(2_147_483_646),
}).strict();

const VIEW_ROLES: readonly ProjectRole[] = [
  'owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer',
];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer'];

const fields = {
  experience: projects.uxExperience,
  design: projects.uxDesign,
  goal: projects.uxGoal,
  revision: projects.uxGoalRevision,
};

/** Project-wide intention, above scenario and domain design. PF-GOAL-INV1/2/3. */
export function makeProjectUxGoalRouter(): Hono {
  const router = new Hono();
  router.get('/', requireAuth, requireRole(VIEW_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const [definition] = await getDb().select(fields).from(projects)
      .where(and(eq(projects.id, c.req.param('pid')!), isNull(projects.deletedAt))).limit(1);
    if (!definition) throw AppError.notFound('project_not_found');
    return c.json({ definition });
  });
  router.put('/', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const parsed = inputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const data = parsed.data;
    const projectId = c.req.param('pid')!;
    const [definition] = await getDb().update(projects).set({
      uxExperience: data.experience, uxDesign: data.design, uxGoal: data.goal,
      uxGoalRevision: data.expectedRevision + 1, updatedAt: new Date(),
    }).where(and(eq(projects.id, projectId), isNull(projects.deletedAt),
      eq(projects.uxGoalRevision, data.expectedRevision))).returning(fields);
    if (!definition) {
      // 版不一致と 「プロジェクトが無い/削除済み」 は同じ 0 件更新になるので、 ここで区別する。
      const [current] = await getDb().select({ revision: projects.uxGoalRevision }).from(projects)
        .where(and(eq(projects.id, projectId), isNull(projects.deletedAt))).limit(1);
      if (!current) throw AppError.notFound('project_not_found');
      throw AppError.conflict('ux_goal_revision_conflict');
    }
    await recordAudit({ projectId, actor: getIdentity(c), action: 'project.ux_goal.update',
      targetKind: 'project', targetId: projectId, meta: { revision: definition.revision } });
    return c.json({ definition });
  });
  return router;
}
