// GET /api/projects/:pid/scene-map — 遷移図 (シーン中心) の読み取り専用集約 (spec/feature/scene-map.md)。
import { Hono } from 'hono';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, getDbState } from '../db/connection.ts';
import { layouts, layoutObjects } from '../db/schema/layout.ts';
import { specs, specTargets } from '../db/schema/spec.ts';
import { transitions } from '../db/schema/screen-flow.ts';
import { requireAuth } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { buildSceneMap } from '../lib/scene-map.ts';
import { type ProjectRole } from '../db/schema/project.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];

export function makeSceneMapRouter(): Hono {
  const r = new Hono();
  r.get('/', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
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
    return c.json(buildSceneMap({ layouts: layoutRows, transitions: transitionRows, specs: specRows, targets: targetRows, placements: placementRows }));
  });
  return r;
}
