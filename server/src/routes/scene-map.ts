// 遷移図 (シーン中心) — spec/feature/scene-map.md。
// GET / は読み取り専用の集約、PUT /positions はキャンバス上の位置だけを保存する (PF-MAP-10)。
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, getDbState } from '../db/connection.ts';
import { layouts, layoutObjects } from '../db/schema/layout.ts';
import { specs, specTargets } from '../db/schema/spec.ts';
import { transitions } from '../db/schema/screen-flow.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { buildSceneMap } from '../lib/scene-map.ts';
import { readCaptureLayouts, readScenePositions, readSceneCapture, saveScenePositions } from '../lib/scene-map-store.ts';
import { scenePositionsSchema } from '../../../shared/scene-map-layout.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
/** シーンエディタの編集と同じ権限 (PF-MAP-10)。 */
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

export function makeSceneMapRouter(): Hono {
  const r = new Hono();
  r.use('*', requireAuth, requireRole(ALL_ROLES));
  r.use('*', async (c, next) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const [project] = await getDb().select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, c.req.param('pid')!), isNull(projects.deletedAt))).limit(1);
    if (!project) throw AppError.notFound('project_not_found');
    await next();
  });
  r.get('/', async (c) => {
    const pid = c.req.param('pid')!;
    const db = getDb();
    const layoutRows = await db.select().from(layouts).where(and(eq(layouts.projectId, pid), isNull(layouts.deletedAt)));
    const specRows = await db.select().from(specs).where(and(eq(specs.projectId, pid), isNull(specs.deletedAt)));
    const transitionRows = await db.select().from(transitions).where(eq(transitions.projectId, pid));
    const specIds = specRows.map((s) => s.id);
    const layoutIds = layoutRows.map((l) => l.id);
    const targetRows = specIds.length ? await db.select().from(specTargets).where(inArray(specTargets.specId, specIds)) : [];
    const placementRows = layoutIds.length
      ? await db.select({ layoutId: layoutObjects.layoutId, objectId: layoutObjects.objectId }).from(layoutObjects).where(inArray(layoutObjects.layoutId, layoutIds))
      : [];
    const [positions, captures] = await Promise.all([readScenePositions(pid), readCaptureLayouts(pid)]);
    return c.json(buildSceneMap({
      layouts: layoutRows, transitions: transitionRows, specs: specRows, targets: targetRows, placements: placementRows,
      positions, captures, canEdit: EDIT_ROLES.includes(c.get('projectRole') as ProjectRole),
    }));
  });
  r.get('/scenes/:lid/capture', async (c) => {
    const capture = await readSceneCapture(c.req.param('pid')!, c.req.param('lid')!);
    if (!capture) throw AppError.notFound('capture_not_found');
    return c.body(capture.body, 200, { 'content-type': capture.contentType, 'cache-control': 'private, max-age=60' });
  });
  r.put('/positions', requireRole(EDIT_ROLES), bodyLimit({ maxSize: 65536 }), async (c) => {
    const parsed = scenePositionsSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_scene_positions', parsed.error.flatten());
    const saved = await saveScenePositions(c.req.param('pid')!, parsed.data, getIdentity(c).userId);
    return c.json({ saved });
  });
  return r;
}
