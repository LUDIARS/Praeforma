// /api/projects/:pid/specs — specs + targets + acceptance、 楽観ロック付き。
//
// 編集は spec.version を CAS。 prev_version 不一致は 409 Conflict + 最新 version を body に。

import { Hono } from 'hono';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { specs, specTargets, specAcceptance } from '../db/schema/spec.ts';
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

const targetSchema = z.object({
  // 'layout' = シーン (要件定義モードで scene を spec の target にできるよう拡張、 migration 003)
  kind: z.enum(['object', 'domain', 'project', 'layout']),
  ref_id: z.string().min(1),
});

const acceptanceItemSchema = z.object({
  id: z.string().optional(),
  ordinal: z.number().int().min(0).optional(),
  text: z.string().min(1).max(2000),
  level: z.enum(['manual', 'assertion', 'event']).optional(),
  expression: z.string().nullish(),
  kind: z.enum(['positive', 'negative']).optional(),
  enabled: z.boolean().optional(),
});

const createSchema = z.object({
  code: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(20000).nullish(),
  priority: z.enum(['must', 'should', 'could', 'wont']).optional(),
  category: z.enum(['behavior', 'appearance', 'data', 'interaction']).optional(),
  preconditions: z.array(z.string()).optional(),
  postconditions: z.array(z.string()).optional(),
  status: z.enum(['draft', 'review', 'approved', 'obsolete']).optional(),
  targets: z.array(targetSchema).optional(),
  acceptance: z.array(acceptanceItemSchema).optional(),
});

const updateSchema = z.object({
  prev_version: z.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(20000).nullish(),
  priority: z.enum(['must', 'should', 'could', 'wont']).optional(),
  category: z.enum(['behavior', 'appearance', 'data', 'interaction']).optional(),
  preconditions: z.array(z.string()).optional(),
  postconditions: z.array(z.string()).optional(),
  status: z.enum(['draft', 'review', 'approved', 'obsolete']).optional(),
});

const targetsReplaceSchema = z.object({
  targets: z.array(targetSchema),
});

const acceptanceReplaceSchema = z.object({
  items: z.array(acceptanceItemSchema),
});

export function makeSpecRouter(): Hono {
  const r = new Hono();

  r.get('/', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const page = parsePagination(c.req.query());
    const status = c.req.query('status');
    const conds = [eq(specs.projectId, pid), isNull(specs.deletedAt)];
    if (status) conds.push(eq(specs.status, status));
    const items = await getDb()
      .select()
      .from(specs)
      .where(and(...conds))
      .orderBy(desc(specs.updatedAt))
      .limit(page.limit)
      .offset(page.offset);
    return c.json({ items, limit: page.limit, offset: page.offset });
  });

  r.get('/:sid', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const sid = c.req.param('sid')!;
    const [row] = await getDb().select().from(specs).where(eq(specs.id, sid)).limit(1);
    if (!row) throw AppError.notFound();
    const targets = await getDb()
      .select()
      .from(specTargets)
      .where(eq(specTargets.specId, sid));
    const acceptance = await getDb()
      .select()
      .from(specAcceptance)
      .where(eq(specAcceptance.specId, sid))
      .orderBy(asc(specAcceptance.ordinal));
    return c.json({ spec: row, targets, acceptance });
  });

  r.post('/', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    // code unique check
    const existing = await getDb()
      .select()
      .from(specs)
      .where(and(eq(specs.projectId, pid), eq(specs.code, parsed.data.code)))
      .limit(1);
    if (existing.length > 0) throw AppError.conflict('spec_code_exists');

    const sid = ulid();
    const id = getIdentity(c);
    await getDb()
      .insert(specs)
      .values({
        id: sid,
        projectId: pid,
        code: parsed.data.code,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        priority: parsed.data.priority ?? 'should',
        category: parsed.data.category ?? 'behavior',
        preconditions: parsed.data.preconditions ?? [],
        postconditions: parsed.data.postconditions ?? [],
        status: parsed.data.status ?? 'draft',
        createdBy: id.userId,
      });

    if (parsed.data.targets && parsed.data.targets.length > 0) {
      await getDb()
        .insert(specTargets)
        .values(parsed.data.targets.map((t) => ({ specId: sid, kind: t.kind, refId: t.ref_id })));
    }
    if (parsed.data.acceptance && parsed.data.acceptance.length > 0) {
      await getDb()
        .insert(specAcceptance)
        .values(
          parsed.data.acceptance.map((a, i) => ({
            id: ulid(),
            specId: sid,
            ordinal: a.ordinal ?? i,
            text: a.text,
            level: a.level ?? 'manual',
            expression: a.expression ?? null,
            kind: a.kind ?? 'positive',
            enabled: a.enabled ?? true,
          })),
        );
    }

    await recordAudit({
      projectId: pid,
      actor: id,
      action: 'spec.create',
      targetKind: 'spec',
      targetId: sid,
      meta: { code: parsed.data.code, title: parsed.data.title },
    });
    const [row] = await getDb().select().from(specs).where(eq(specs.id, sid)).limit(1);
    return c.json({ spec: row }, 201);
  });

  r.patch('/:sid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const sid = c.req.param('sid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    // 楽観ロック CAS
    const [before] = await getDb().select().from(specs).where(eq(specs.id, sid)).limit(1);
    if (!before) throw AppError.notFound();
    if (before.version !== parsed.data.prev_version) {
      throw AppError.conflict('version_conflict', {
        server_version: before.version,
        provided_version: parsed.data.prev_version,
      });
    }

    const patch: Record<string, unknown> = {
      version: before.version + 1,
      updatedAt: new Date(),
    };
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority;
    if (parsed.data.category !== undefined) patch.category = parsed.data.category;
    if (parsed.data.preconditions !== undefined) patch.preconditions = parsed.data.preconditions;
    if (parsed.data.postconditions !== undefined) patch.postconditions = parsed.data.postconditions;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;

    await getDb().update(specs).set(patch).where(eq(specs.id, sid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'spec.update',
      targetKind: 'spec',
      targetId: sid,
      meta: { from_version: before.version, to_version: before.version + 1 },
    });
    const [row] = await getDb().select().from(specs).where(eq(specs.id, sid)).limit(1);
    return c.json({ spec: row });
  });

  r.delete('/:sid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const sid = c.req.param('sid')!;
    await getDb()
      .update(specs)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(specs.id, sid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'spec.delete',
      targetKind: 'spec',
      targetId: sid,
    });
    return c.json({ ok: true });
  });

  // ── targets ────────────────────────────────────────────────────────

  r.put('/:sid/targets', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const sid = c.req.param('sid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = targetsReplaceSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    await getDb().delete(specTargets).where(eq(specTargets.specId, sid));
    if (parsed.data.targets.length > 0) {
      await getDb()
        .insert(specTargets)
        .values(parsed.data.targets.map((t) => ({ specId: sid, kind: t.kind, refId: t.ref_id })));
    }
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'spec.targets_replace',
      targetKind: 'spec',
      targetId: sid,
      meta: { count: parsed.data.targets.length },
    });
    const rows = await getDb().select().from(specTargets).where(eq(specTargets.specId, sid));
    return c.json({ targets: rows });
  });

  // ── acceptance ─────────────────────────────────────────────────────

  r.put('/:sid/acceptance', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const sid = c.req.param('sid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = acceptanceReplaceSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    // level != manual のときは expression が必須 (= DB CHECK にもあるが、 早めに弾く)
    for (const item of parsed.data.items) {
      if ((item.level && item.level !== 'manual') && !item.expression) {
        throw AppError.badRequest('expression_required_for_non_manual');
      }
    }

    await getDb().delete(specAcceptance).where(eq(specAcceptance.specId, sid));
    if (parsed.data.items.length > 0) {
      await getDb()
        .insert(specAcceptance)
        .values(
          parsed.data.items.map((a, i) => ({
            id: a.id ?? ulid(),
            specId: sid,
            ordinal: a.ordinal ?? i,
            text: a.text,
            level: a.level ?? 'manual',
            expression: a.expression ?? null,
            kind: a.kind ?? 'positive',
            enabled: a.enabled ?? true,
          })),
        );
    }
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'spec.acceptance_replace',
      targetKind: 'spec',
      targetId: sid,
      meta: { count: parsed.data.items.length },
    });
    const rows = await getDb()
      .select()
      .from(specAcceptance)
      .where(eq(specAcceptance.specId, sid))
      .orderBy(asc(specAcceptance.ordinal));
    return c.json({ acceptance: rows });
  });

  return r;
}
