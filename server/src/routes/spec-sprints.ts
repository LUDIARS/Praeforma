/** PF-SPRINT: group fragments, check their implementation state and structure them together. */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { createSprintSchema, addSprintFragmentsSchema } from '../lib/spec-sprint-input.ts';
import {
  listSprints, readSprint, sprintFragments, unassignedFragments, createSprint, addSprintFragments, removeSprintFragment,
} from '../lib/spec-sprint-store.ts';
import { AppError } from '../lib/errors.ts';

const VIEW_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
// PF-SPRINT-7: the same roles that can register fragments and update their implementation state.
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer'];
const RECONSTRUCT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

export function makeSpecSprintRouter(): Hono {
  const router = new Hono();
  router.use('*', requireAuth, requireRole(VIEW_ROLES), bodyLimit({ maxSize: 32768 }));
  router.use('*', async (context, next) => {
    const [project] = await getDb().select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, context.req.param('pid')!), isNull(projects.deletedAt))).limit(1);
    if (!project) throw AppError.notFound('project_not_found');
    await next();
  });
  const permissions = (role: ProjectRole) => ({ canEdit: EDIT_ROLES.includes(role), canReconstruct: RECONSTRUCT_ROLES.includes(role) });
  router.get('/', async (context) =>
    context.json({ items: await listSprints(context.req.param('pid')!), ...permissions(context.get('projectRole')) }));
  router.get('/unassigned', async (context) =>
    context.json({ items: await unassignedFragments(context.req.param('pid')!) }));
  router.post('/', requireRole(EDIT_ROLES), async (context) => {
    const parsed = createSprintSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_sprint', parsed.error.flatten());
    const sprint = await createSprint(context.req.param('pid')!, parsed.data, getIdentity(context).userId);
    return context.json({ sprint }, 201);
  });
  router.get('/:sid', async (context) => {
    const pid = context.req.param('pid')!;
    const sid = context.req.param('sid')!;
    return context.json({ sprint: await readSprint(pid, sid), fragments: await sprintFragments(pid, sid),
      ...permissions(context.get('projectRole')) });
  });
  router.post('/:sid/fragments', requireRole(EDIT_ROLES), async (context) => {
    const parsed = addSprintFragmentsSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_sprint_fragments', parsed.error.flatten());
    const sprint = await addSprintFragments(context.req.param('pid')!, context.req.param('sid')!,
      parsed.data.fragmentIds, getIdentity(context).userId);
    return context.json({ sprint });
  });
  router.delete('/:sid/fragments/:fid', requireRole(EDIT_ROLES), async (context) =>
    context.json({ sprint: await removeSprintFragment(context.req.param('pid')!, context.req.param('sid')!, context.req.param('fid')!) }));
  return router;
}
