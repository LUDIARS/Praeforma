// /api/projects/:pid/objects + /:oid/attrs
//
// role:
//   - list / get: viewer 以上
//   - create / update / delete: owner / planner
//   - attrs upsert: owner / planner

import { Hono } from 'hono';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { objects, objectAttrs } from '../db/schema/object.ts';
import { type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { parsePagination } from '../lib/pagination.ts';
import { recordAudit } from '../lib/audit.ts';

const ALL_ROLES: readonly ProjectRole[] = [
  'owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer',
];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

const createSchema = z.object({
  domain_id: z.string().min(1),
  label: z.string().min(1).max(200),
  placeholder_shape: z.string().max(40).optional(),
  placeholder_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  placeholder_image_asset_id: z.string().nullish(),
  parent_object_id: z.string().nullish(),
});

const updateSchema = createSchema.partial();

const attrSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.unknown(),
});

const attrsBulkSchema = z.object({
  attrs: z.array(attrSchema),
});

export function makeObjectRouter(): Hono {
  const r = new Hono();

  r.get('/', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const page = parsePagination(c.req.query());
    const domainFilter = c.req.query('domain');
    const conds = [eq(objects.projectId, pid), isNull(objects.deletedAt)];
    if (domainFilter) conds.push(eq(objects.domainId, domainFilter));
    const items = await getDb()
      .select()
      .from(objects)
      .where(and(...conds))
      .orderBy(asc(objects.label))
      .limit(page.limit)
      .offset(page.offset);
    return c.json({ items, limit: page.limit, offset: page.offset });
  });

  r.get('/:oid', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const oid = c.req.param('oid')!;
    const [row] = await getDb().select().from(objects).where(eq(objects.id, oid)).limit(1);
    if (!row) throw AppError.notFound();
    const attrs = await getDb()
      .select()
      .from(objectAttrs)
      .where(eq(objectAttrs.objectId, oid));
    return c.json({ object: row, attrs });
  });

  r.post('/', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const oid = ulid();
    await getDb()
      .insert(objects)
      .values({
        id: oid,
        projectId: pid,
        domainId: parsed.data.domain_id,
        label: parsed.data.label,
        placeholderShape: parsed.data.placeholder_shape ?? 'cube',
        placeholderColor: parsed.data.placeholder_color ?? '#888888',
        placeholderImageAssetId: parsed.data.placeholder_image_asset_id ?? null,
        parentObjectId: parsed.data.parent_object_id ?? null,
      });
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'object.create',
      targetKind: 'object',
      targetId: oid,
      meta: { label: parsed.data.label, domain_id: parsed.data.domain_id },
    });
    const [row] = await getDb().select().from(objects).where(eq(objects.id, oid)).limit(1);
    return c.json({ object: row }, 201);
  });

  r.patch('/:oid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const oid = c.req.param('oid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.domain_id !== undefined) patch.domainId = parsed.data.domain_id;
    if (parsed.data.label !== undefined) patch.label = parsed.data.label;
    if (parsed.data.placeholder_shape !== undefined) patch.placeholderShape = parsed.data.placeholder_shape;
    if (parsed.data.placeholder_color !== undefined) patch.placeholderColor = parsed.data.placeholder_color;
    if (parsed.data.placeholder_image_asset_id !== undefined)
      patch.placeholderImageAssetId = parsed.data.placeholder_image_asset_id;
    if (parsed.data.parent_object_id !== undefined) patch.parentObjectId = parsed.data.parent_object_id;

    await getDb().update(objects).set(patch).where(eq(objects.id, oid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'object.update',
      targetKind: 'object',
      targetId: oid,
      meta: parsed.data,
    });
    const [row] = await getDb().select().from(objects).where(eq(objects.id, oid)).limit(1);
    if (!row) throw AppError.notFound();
    return c.json({ object: row });
  });

  r.delete('/:oid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const oid = c.req.param('oid')!;
    await getDb()
      .update(objects)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(objects.id, oid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'object.delete',
      targetKind: 'object',
      targetId: oid,
    });
    return c.json({ ok: true });
  });

  // ── attrs (key / value 一括 upsert) ────────────────────────────────────

  r.put('/:oid/attrs', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const oid = c.req.param('oid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = attrsBulkSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    // 既存全削除 → 一括 insert (= 単純な実装。 高頻度なら upsert に最適化)
    await getDb().delete(objectAttrs).where(eq(objectAttrs.objectId, oid));
    if (parsed.data.attrs.length > 0) {
      await getDb()
        .insert(objectAttrs)
        .values(
          parsed.data.attrs.map((a) => ({
            objectId: oid,
            key: a.key,
            value: a.value as never,
          })),
        );
    }
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'object.attrs_replace',
      targetKind: 'object',
      targetId: oid,
      meta: { count: parsed.data.attrs.length },
    });
    const rows = await getDb()
      .select()
      .from(objectAttrs)
      .where(eq(objectAttrs.objectId, oid));
    return c.json({ attrs: rows });
  });

  return r;
}
