import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb, getDbState } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { requireAuth } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { fetchDefinitionTodos } from '../lib/ux-definition-todos.ts';
import type { AnatomiaGraphOptions } from '../lib/anatomia-graph/client.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];

export function makeDefinitionTodosRouter(options: AnatomiaGraphOptions): Hono {
  const router = new Hono();
  router.get('/definition-todos', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const [project] = await getDb().select({ anatomiaRepo: projects.anatomiaRepo }).from(projects).where(eq(projects.id, c.req.param('pid')!)).limit(1);
    if (!project) throw AppError.notFound('project_not_found');
    if (!project.anatomiaRepo) throw new AppError('anatomia_repo_unset', 409);
    return c.json(await fetchDefinitionTodos(options, project.anatomiaRepo));
  });
  return router;
}
