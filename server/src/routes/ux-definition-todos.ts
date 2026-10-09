import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb, getDbState } from '../db/connection.ts';
import { domains } from '../db/schema/domain.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { readMemberships } from '../db/domain-assignment.ts';
import { requireAuth } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { domainLinkTodos } from '../../../shared/domain-link-todos.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];

/** 概要の TODO。 Pf のコア↔ビジネスドメインのつながりだけを見る (spec/feature/ux-definition-todos.md)。 */
export function makeDefinitionTodosRouter(): Hono {
  const router = new Hono();
  router.get('/definition-todos', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const [project] = await getDb().select({ id: projects.id }).from(projects).where(eq(projects.id, pid)).limit(1);
    if (!project) throw AppError.notFound('project_not_found');
    const rows = await getDb().select({ id: domains.id, name: domains.name, definitionKind: domains.definitionKind, parentId: domains.parentId })
      .from(domains).where(eq(domains.projectId, pid));
    const items = domainLinkTodos(pid, rows.map(row => ({ ...row, definitionKind: row.definitionKind ?? null })), await readMemberships(pid));
    return c.json({ items });
  });
  return router;
}
