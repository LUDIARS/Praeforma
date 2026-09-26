// /api/projects/:pid/ux-goal — プロジェクト最上位の UX/Goal (spec/feature/project-ux-goal.md)。
//
// role:
//   - get: viewer 以上 (プロジェクトメンバー)
//   - put: owner / planner / designer
// PF-GOAL-INV1 (プロジェクト単位で分離) / PF-GOAL-INV2 (版不一致は 409 で上書きしない)。
// PF-GOAL-W2: ストーリー (カスタマージャーニー) と、かかわる感情の定義。
// 旧クライアントはこの 2 つを送らないので、 省略時は保存済みの値を残す (空欄で消さない)。
// PF-GOAL-W3: キャッチコピー。人の文言を正本にし、文言が変わったら origin を human にする (shared/catchcopy.ts)。
// 省略時は保存済みの文言と origin を残す。

import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { CATCHCOPY_MAX, nextCatchcopyOrigin, type CatchcopyOrigin } from '../../../shared/catchcopy.ts';

const text = z.string().max(20_000);
const inputSchema = z.object({
  experience: text,
  design: text,
  goal: text,
  story: text.optional(),
  emotions: text.optional(),
  catchcopy: z.string().trim().max(CATCHCOPY_MAX).optional(),
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
  story: projects.uxStory,
  emotions: projects.uxEmotions,
  catchcopy: projects.uxCatchcopy,
  catchcopyOrigin: projects.uxCatchcopyOrigin,
  revision: projects.uxGoalRevision,
};

/** Project-wide intention, above scenario and domain design. PF-GOAL-INV1/2/3, PF-GOAL-W2. */
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
    const catchcopy = data.catchcopy === undefined ? {} : await catchcopyChange(projectId, data.catchcopy);
    const [definition] = await getDb().update(projects).set({
      uxExperience: data.experience, uxDesign: data.design, uxGoal: data.goal,
      ...(data.story !== undefined ? { uxStory: data.story } : {}),
      ...(data.emotions !== undefined ? { uxEmotions: data.emotions } : {}),
      ...catchcopy,
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

/**
 * 新しい文言と origin。保存済みの行と比べて決める。この読み取りと更新の間に別の保存が入った場合は、
 * 更新側の版一致 (expectedRevision) で 409 になるので、古い比較結果で書くことはない。
 */
async function catchcopyChange(projectId: string, text: string): Promise<{ uxCatchcopy: string; uxCatchcopyOrigin: CatchcopyOrigin }> {
  const [row] = await getDb().select({ text: projects.uxCatchcopy, origin: projects.uxCatchcopyOrigin }).from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt))).limit(1);
  if (!row) throw AppError.notFound('project_not_found');
  return { uxCatchcopy: text, uxCatchcopyOrigin: nextCatchcopyOrigin(row, text) };
}
