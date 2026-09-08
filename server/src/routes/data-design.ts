/** Project-scoped schema authoring; no Cernere runtime mutation. PF-DATA-1/2/7/8. */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, eq, isNull } from 'drizzle-orm';
import type { DataDesignSnapshot } from '../../../shared/data-design.ts';
import { validateDataDesign } from '../../../shared/data-design-validation.ts';
import { getDb, getDbState } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { dataDesigns } from '../db/schema/data-design.ts';
import { persistDataDesign } from '../db/data-design-persistence.ts';
import { dataDesignSchema, saveDataDesignSchema } from '../lib/data-design-input.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';

const VIEW_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer'];

async function requireProject(projectId: string): Promise<void> {
  if (!getDbState().ok) throw AppError.internal('db_unavailable');
  const [project] = await getDb().select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt))).limit(1);
  if (!project) throw AppError.notFound('project_not_found');
}

export function makeDataDesignRouter(): Hono {
  const router = new Hono();
  router.use('*', requireAuth, requireRole(VIEW_ROLES));
  router.get('/', async (c) => {
    const pid = c.req.param('pid')!;
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const [project] = await getDb().select({ document: { definition: dataDesigns.definition,
      revision: dataDesigns.revision, updatedAt: dataDesigns.updatedAt } }).from(projects)
      .leftJoin(dataDesigns, eq(projects.id, dataDesigns.projectId))
      .where(and(eq(projects.id, pid), isNull(projects.deletedAt))).limit(1);
    if (!project) throw AppError.notFound('project_not_found');
    const row = project.document;
    const parsed = row ? dataDesignSchema.safeParse(row.definition) : null;
    if (parsed && !parsed.success) throw AppError.internal('data_design_invalid_storage');
    const snapshot: DataDesignSnapshot = row && parsed?.success
      ? { definition: parsed.data, revision: row.revision, updatedAt: row.updatedAt.toISOString() }
      : { definition: { schemaVersion: 1, datasets: [] }, revision: 0, updatedAt: null };
    return c.json({ snapshot, canEdit: EDIT_ROLES.includes(c.get('projectRole')),
      issues: validateDataDesign(snapshot.definition) });
  });
  router.put('/', requireRole(EDIT_ROLES), bodyLimit({ maxSize: 1_048_576 }), async (c) => {
    const pid = c.req.param('pid')!;
    await requireProject(pid);
    const parsed = saveDataDesignSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_data_design', parsed.error.flatten());
    const { definition, expectedRevision } = parsed.data;
    const issues = validateDataDesign(definition);
    if (issues.some((issue) => issue.severity === 'error')) {
      throw AppError.badRequest('invalid_data_design', { issues });
    }
    const snapshot = await persistDataDesign(pid, getIdentity(c).userId, definition, expectedRevision);
    if (!snapshot) {
      await requireProject(pid);
      throw AppError.conflict('data_design_revision_conflict');
    }
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'data_design.save',
      targetKind: 'data_design', targetId: pid, meta: { revision: snapshot.revision, datasetCount: definition.datasets.length } });
    return c.json({ snapshot, canEdit: true, issues });
  });
  return router;
}
