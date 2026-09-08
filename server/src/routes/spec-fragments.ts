/** Project-scoped immutable input and revision-checked implementation state. */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { getDb } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { specFragments } from '../db/schema/spec-fragment.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { createFragmentSchema, fragmentImplementationSchema } from '../lib/spec-fragment-input.ts';
import { parsePagination } from '../lib/pagination.ts';
import { AppError } from '../lib/errors.ts';

const VIEW_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer'];

export function makeSpecFragmentRouter(): Hono {
  const router = new Hono();
  router.use('*', requireAuth, requireRole(VIEW_ROLES));
  router.use('*', async (context, next) => {
    const [project] = await getDb().select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, context.req.param('pid')!), isNull(projects.deletedAt))).limit(1);
    if (!project) throw AppError.notFound('project_not_found');
    await next();
  });
  router.get('/', async (context) => {
    const page = parsePagination(context.req.query());
    if (!Number.isInteger(page.limit) || !Number.isInteger(page.offset)) throw AppError.badRequest('invalid_page');
    const items = await getDb().select().from(specFragments)
      .where(eq(specFragments.projectId, context.req.param('pid')!))
      .orderBy(desc(specFragments.createdAt), desc(specFragments.id)).limit(page.limit + 1).offset(page.offset);
    return context.json({ items: items.slice(0, page.limit), hasMore: items.length > page.limit,
      canEdit: EDIT_ROLES.includes(context.get('projectRole')), ...page });
  });
  router.post('/', requireRole(EDIT_ROLES), bodyLimit({ maxSize: 131072 }), async (context) => {
    const parsed = createFragmentSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_fragment', parsed.error.flatten());
    const projectId = context.req.param('pid')!;
    const actorId = getIdentity(context).userId;
    // The browser cannot claim a Cc origin. The adapter will get a separate authenticated contract.
    const source = 'pf';
    const { content, sourceEventId } = parsed.data;
    const inserted = await getDb().insert(specFragments).values({ id: ulid(), projectId, content,
      source, sourceEventId, createdBy: actorId }).onConflictDoNothing({
      target: [specFragments.projectId, specFragments.source, specFragments.sourceEventId],
    }).returning();
    if (inserted[0]) return context.json({ fragment: inserted[0], replayed: false }, 201);
    const [existing] = await getDb().select().from(specFragments).where(and(
      eq(specFragments.projectId, projectId), eq(specFragments.source, source), eq(specFragments.sourceEventId, sourceEventId),
    )).limit(1);
    if (!existing || existing.content !== content || existing.createdBy !== actorId) {
      throw AppError.conflict('fragment_event_conflict');
    }
    return context.json({ fragment: existing, replayed: true });
  });
  router.patch('/:fid/implementation', requireRole(EDIT_ROLES), bodyLimit({ maxSize: 32768 }), async (context) => {
    const parsed = fragmentImplementationSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_implementation_state', parsed.error.flatten());
    const scope = and(eq(specFragments.projectId, context.req.param('pid')!), eq(specFragments.id, context.req.param('fid')!));
    const [before] = await getDb().select().from(specFragments).where(scope).limit(1);
    if (!before) throw AppError.notFound('fragment_not_found');
    const { expectedRevision, implementationState, implementationEvidence } = parsed.data;
    const [fragment] = await getDb().update(specFragments).set({ implementationState, implementationEvidence,
      implementationUpdatedBy: getIdentity(context).userId, implementationUpdatedAt: new Date(), revision: expectedRevision + 1,
    }).where(and(scope, eq(specFragments.revision, expectedRevision))).returning();
    if (!fragment) throw AppError.conflict('fragment_revision_conflict');
    return context.json({ fragment });
  });
  return router;
}
