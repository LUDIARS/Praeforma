// /api/projects/:pid/layouts — layouts + layout_objects + cameras。
//
// layout_objects.transform 編集は designer も可 (= lock_transform=false の placement のみ)。
// それ以外 (= layout 自体 / placement 追加削除 / camera CRUD) は owner / planner。

import { Hono } from 'hono';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { layouts, layoutObjects, cameras } from '../db/schema/layout.ts';
import { type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';

const ALL_ROLES: readonly ProjectRole[] = [
  'owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer',
];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];
const TRANSFORM_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer'];

const transform3 = z.array(z.number()).length(3);
const transform4 = z.array(z.number()).length(4);
const positionSchema = z.union([transform3, transform4]);

const layoutCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  kind: z.enum(['world-3d', 'world-2d', 'ui-2d']).optional(),
  is_default: z.boolean().optional(),
});

const layoutUpdateSchema = layoutCreateSchema.partial();

const layoutObjectSchema = z.object({
  id: z.string().optional(), // 既存更新時のみ
  object_id: z.string().min(1),
  position: positionSchema.optional(),
  rotation: positionSchema.optional(),
  scale: positionSchema.optional(),
  parent_layout_object_id: z.string().nullish(),
  lock_transform: z.boolean().optional(),
  ordinal: z.number().int().min(0).optional(),
});

const layoutObjectsBulkSchema = z.object({
  items: z.array(layoutObjectSchema),
});

const cameraSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(['perspective', 'orthographic']).optional(),
  position: transform3.optional(),
  target: transform3.optional(),
  up: transform3.optional(),
  fov: z.number().positive().optional(),
  ortho_size: z.number().positive().optional(),
  near: z.number().positive().optional(),
  far: z.number().positive().optional(),
  is_default: z.boolean().optional(),
});

export function makeLayoutRouter(): Hono {
  const r = new Hono();

  // ── layouts ────────────────────────────────────────────────────────

  r.get('/', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const items = await getDb()
      .select()
      .from(layouts)
      .where(and(eq(layouts.projectId, pid), isNull(layouts.deletedAt)))
      .orderBy(asc(layouts.name));
    return c.json({ items });
  });

  r.get('/:lid', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const lid = c.req.param('lid')!;
    const [layout] = await getDb().select().from(layouts).where(eq(layouts.id, lid)).limit(1);
    if (!layout) throw AppError.notFound();
    const placements = await getDb()
      .select()
      .from(layoutObjects)
      .where(eq(layoutObjects.layoutId, lid))
      .orderBy(asc(layoutObjects.ordinal));
    const cams = await getDb()
      .select()
      .from(cameras)
      .where(eq(cameras.layoutId, lid))
      .orderBy(asc(cameras.name));
    return c.json({ layout, layout_objects: placements, cameras: cams });
  });

  r.post('/', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = layoutCreateSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const lid = ulid();
    await getDb()
      .insert(layouts)
      .values({
        id: lid,
        projectId: pid,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        kind: parsed.data.kind ?? 'world-3d',
        isDefault: parsed.data.is_default ?? false,
      });
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'layout.create',
      targetKind: 'layout',
      targetId: lid,
      meta: { name: parsed.data.name },
    });
    const [row] = await getDb().select().from(layouts).where(eq(layouts.id, lid)).limit(1);
    return c.json({ layout: row }, 201);
  });

  r.patch('/:lid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const lid = c.req.param('lid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = layoutUpdateSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.kind !== undefined) patch.kind = parsed.data.kind;
    if (parsed.data.is_default !== undefined) patch.isDefault = parsed.data.is_default;
    await getDb().update(layouts).set(patch).where(eq(layouts.id, lid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'layout.update',
      targetKind: 'layout',
      targetId: lid,
      meta: parsed.data,
    });
    const [row] = await getDb().select().from(layouts).where(eq(layouts.id, lid)).limit(1);
    if (!row) throw AppError.notFound();
    return c.json({ layout: row });
  });

  r.delete('/:lid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const lid = c.req.param('lid')!;
    await getDb()
      .update(layouts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(layouts.id, lid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'layout.delete',
      targetKind: 'layout',
      targetId: lid,
    });
    return c.json({ ok: true });
  });

  // ── layout_objects (placements) ────────────────────────────────────

  /**
   * 一括 replace。 既存 placement との diff を取って:
   *   - id 一致: UPDATE (transform / parent / lock / ordinal)
   *   - id 不一致 + 新規: INSERT
   *   - 既存にあるが body に無いものは DELETE
   * 役割は designer も transform 編集可 (= TRANSFORM_ROLES)、 ただし lock 中の
   * placement の transform は planner/owner のみ。
   */
  r.put('/:lid/objects', requireAuth, requireRole(TRANSFORM_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const lid = c.req.param('lid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = layoutObjectsBulkSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    const role = c.get('projectRole') as ProjectRole;
    const isPlanner = role === 'owner' || role === 'planner';

    // 既存全件取って diff
    const existing = await getDb()
      .select()
      .from(layoutObjects)
      .where(eq(layoutObjects.layoutId, lid));
    const existingById = new Map(existing.map((r) => [r.id, r]));
    const seenIds = new Set<string>();

    for (const item of parsed.data.items) {
      if (item.id && existingById.has(item.id)) {
        const before = existingById.get(item.id)!;
        if (before.lockTransform && !isPlanner) {
          throw AppError.forbidden('placement_locked_for_designer');
        }
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (item.position !== undefined) patch.position = item.position;
        if (item.rotation !== undefined) patch.rotation = item.rotation;
        if (item.scale !== undefined) patch.scale = item.scale;
        if (item.parent_layout_object_id !== undefined)
          patch.parentLayoutObjectId = item.parent_layout_object_id;
        if (item.lock_transform !== undefined && isPlanner)
          patch.lockTransform = item.lock_transform;
        if (item.ordinal !== undefined) patch.ordinal = item.ordinal;
        await getDb().update(layoutObjects).set(patch).where(eq(layoutObjects.id, item.id));
        seenIds.add(item.id);
      } else {
        // 新規 INSERT は planner/owner のみ (= designer は既存 placement を動かすだけ)
        if (!isPlanner) throw AppError.forbidden('insert_requires_planner');
        const newId = ulid();
        await getDb()
          .insert(layoutObjects)
          .values({
            id: newId,
            layoutId: lid,
            objectId: item.object_id,
            position: item.position ?? [0, 0, 0],
            rotation: item.rotation ?? [0, 0, 0],
            scale: item.scale ?? [1, 1, 1],
            parentLayoutObjectId: item.parent_layout_object_id ?? null,
            lockTransform: item.lock_transform ?? false,
            ordinal: item.ordinal ?? 0,
          });
        seenIds.add(newId);
      }
    }

    // 削除 — planner/owner のみ
    if (isPlanner) {
      for (const before of existing) {
        if (!seenIds.has(before.id)) {
          await getDb().delete(layoutObjects).where(eq(layoutObjects.id, before.id));
        }
      }
    }

    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'layout.placements_replace',
      targetKind: 'layout',
      targetId: lid,
      meta: { count: parsed.data.items.length },
    });

    const rows = await getDb()
      .select()
      .from(layoutObjects)
      .where(eq(layoutObjects.layoutId, lid))
      .orderBy(asc(layoutObjects.ordinal));
    return c.json({ layout_objects: rows });
  });

  // ── cameras ────────────────────────────────────────────────────────

  r.post('/:lid/cameras', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const lid = c.req.param('lid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = cameraSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const cid = ulid();
    await getDb()
      .insert(cameras)
      .values({
        id: cid,
        layoutId: lid,
        name: parsed.data.name,
        kind: parsed.data.kind ?? 'perspective',
        position: parsed.data.position ?? [0, 5, -10],
        target: parsed.data.target ?? [0, 0, 0],
        up: parsed.data.up ?? [0, 1, 0],
        fov: parsed.data.fov ?? 60.0,
        orthoSize: parsed.data.ortho_size ?? 10.0,
        near: parsed.data.near ?? 0.1,
        far: parsed.data.far ?? 1000.0,
        isDefault: parsed.data.is_default ?? false,
      });
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'camera.create',
      targetKind: 'camera',
      targetId: cid,
      meta: { layout_id: lid, name: parsed.data.name },
    });
    const [row] = await getDb().select().from(cameras).where(eq(cameras.id, cid)).limit(1);
    return c.json({ camera: row }, 201);
  });

  r.patch('/:lid/cameras/:cid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const cid = c.req.param('cid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = cameraSchema.partial().safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.kind !== undefined) patch.kind = parsed.data.kind;
    if (parsed.data.position !== undefined) patch.position = parsed.data.position;
    if (parsed.data.target !== undefined) patch.target = parsed.data.target;
    if (parsed.data.up !== undefined) patch.up = parsed.data.up;
    if (parsed.data.fov !== undefined) patch.fov = parsed.data.fov;
    if (parsed.data.ortho_size !== undefined) patch.orthoSize = parsed.data.ortho_size;
    if (parsed.data.near !== undefined) patch.near = parsed.data.near;
    if (parsed.data.far !== undefined) patch.far = parsed.data.far;
    if (parsed.data.is_default !== undefined) patch.isDefault = parsed.data.is_default;
    await getDb().update(cameras).set(patch).where(eq(cameras.id, cid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'camera.update',
      targetKind: 'camera',
      targetId: cid,
      meta: parsed.data,
    });
    const [row] = await getDb().select().from(cameras).where(eq(cameras.id, cid)).limit(1);
    if (!row) throw AppError.notFound();
    return c.json({ camera: row });
  });

  r.delete('/:lid/cameras/:cid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const cid = c.req.param('cid')!;
    await getDb().delete(cameras).where(eq(cameras.id, cid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'camera.delete',
      targetKind: 'camera',
      targetId: cid,
    });
    return c.json({ ok: true });
  });

  return r;
}
