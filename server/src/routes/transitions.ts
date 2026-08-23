// /api/projects/:pid/transitions — UI 要素起点の画面遷移 CRUD (feature/screen-flow.md §3.2)。
//
// role: list / get = viewer 以上、 create / update / delete = owner / planner
// サーバ検証: from_layout = source placement の layout、 全参照が同一 project。
//
// @spec 3.2 transitions

import { Hono } from 'hono';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { layouts, layoutObjects } from '../db/schema/layout.ts';
import { transitions } from '../db/schema/screen-flow.ts';
import { type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

export const TRIGGER_PATTERN = /^(tap|submit|timeout|event:[A-Za-z0-9_.-]{1,80})$/;

const createSchema = z.object({
  from_layout_id: z.string().min(1),
  source_object_id: z.string().min(1).nullish(),
  to_layout_id: z.string().min(1),
  trigger: z.string().regex(TRIGGER_PATTERN).default('tap'),
  condition: z.string().max(500).default(''),
  label: z.string().max(200).nullish(),
  ordinal: z.number().int().min(0).default(0),
});
const updateSchema = createSchema.partial().extend({ version: z.number().int().positive() });

export interface TransitionInput {
  fromLayoutId: string;
  sourceObjectId: string | null;
  toLayoutId: string;
}

/** 参照整合の検証 (同一 project / 起点 placement が from_layout 上にある)。 route と proposals apply で共用。 */
export async function validateTransitionRefs(pid: string, input: TransitionInput): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: layouts.id })
    .from(layouts)
    .where(and(eq(layouts.projectId, pid), isNull(layouts.deletedAt)));
  const ids = new Set(rows.map((r) => r.id));
  if (!ids.has(input.fromLayoutId)) throw AppError.badRequest('from_layout_not_in_project');
  if (!ids.has(input.toLayoutId)) throw AppError.badRequest('to_layout_not_in_project');
  if (input.sourceObjectId) {
    const [p] = await db
      .select({ layoutId: layoutObjects.layoutId })
      .from(layoutObjects)
      .where(eq(layoutObjects.id, input.sourceObjectId))
      .limit(1);
    if (!p) throw AppError.badRequest('source_object_not_found');
    if (p.layoutId !== input.fromLayoutId) throw AppError.badRequest('source_object_not_on_from_layout');
  }
}

export async function insertTransition(
  pid: string,
  data: z.infer<typeof createSchema>,
): Promise<string> {
  await validateTransitionRefs(pid, {
    fromLayoutId: data.from_layout_id,
    sourceObjectId: data.source_object_id ?? null,
    toLayoutId: data.to_layout_id,
  });
  const id = ulid();
  try {
    await getDb().insert(transitions).values({
      id,
      projectId: pid,
      fromLayoutId: data.from_layout_id,
      sourceObjectId: data.source_object_id ?? null,
      toLayoutId: data.to_layout_id,
      trigger: data.trigger,
      condition: data.condition,
      label: data.label ?? null,
      ordinal: data.ordinal,
    });
  } catch (e) {
    if (/unique|duplicate/i.test(String(e))) throw AppError.conflict('transition_exists');
    throw e;
  }
  return id;
}

export function makeTransitionRouter(): Hono {
  const r = new Hono();

  r.get('/', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const from = c.req.query('from_layout_id');
    const where = from
      ? and(eq(transitions.projectId, pid), eq(transitions.fromLayoutId, from))
      : eq(transitions.projectId, pid);
    const items = await getDb().select().from(transitions).where(where).orderBy(asc(transitions.ordinal));
    return c.json({ items });
  });

  r.get('/:tid', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const tid = c.req.param('tid')!;
    const [row] = await getDb()
      .select()
      .from(transitions)
      .where(and(eq(transitions.id, tid), eq(transitions.projectId, pid)))
      .limit(1);
    if (!row) throw AppError.notFound();
    return c.json({ transition: row });
  });

  r.post('/', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const id = await insertTransition(pid, parsed.data);
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'transition.create',
      targetKind: 'transition',
      targetId: id,
      meta: parsed.data,
    });
    const [row] = await getDb().select().from(transitions).where(eq(transitions.id, id)).limit(1);
    return c.json({ transition: row }, 201);
  });

  r.patch('/:tid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const tid = c.req.param('tid')!;
    const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const [before] = await getDb()
      .select()
      .from(transitions)
      .where(and(eq(transitions.id, tid), eq(transitions.projectId, pid)))
      .limit(1);
    if (!before) throw AppError.notFound();
    if (before.version !== parsed.data.version) throw AppError.conflict('version_mismatch', { current: before.version });

    const d = parsed.data;
    const next = {
      fromLayoutId: d.from_layout_id ?? before.fromLayoutId,
      sourceObjectId: d.source_object_id === undefined ? before.sourceObjectId : (d.source_object_id ?? null),
      toLayoutId: d.to_layout_id ?? before.toLayoutId,
    };
    await validateTransitionRefs(pid, next);
    const patch: Record<string, unknown> = {
      ...next,
      version: before.version + 1,
      updatedAt: new Date(),
    };
    if (d.trigger !== undefined) patch.trigger = d.trigger;
    if (d.condition !== undefined) patch.condition = d.condition;
    if (d.label !== undefined) patch.label = d.label;
    if (d.ordinal !== undefined) patch.ordinal = d.ordinal;
    try {
      await getDb().update(transitions).set(patch).where(eq(transitions.id, tid));
    } catch (e) {
      if (/unique|duplicate/i.test(String(e))) throw AppError.conflict('transition_exists');
      throw e;
    }
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'transition.update',
      targetKind: 'transition',
      targetId: tid,
      meta: d,
    });
    const [row] = await getDb().select().from(transitions).where(eq(transitions.id, tid)).limit(1);
    return c.json({ transition: row });
  });

  r.delete('/:tid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const tid = c.req.param('tid')!;
    const [before] = await getDb()
      .select({ id: transitions.id })
      .from(transitions)
      .where(and(eq(transitions.id, tid), eq(transitions.projectId, pid)))
      .limit(1);
    if (!before) throw AppError.notFound();
    await getDb().delete(transitions).where(and(eq(transitions.id, tid), eq(transitions.projectId, pid)));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'transition.delete',
      targetKind: 'transition',
      targetId: tid,
    });
    return c.json({ ok: true });
  });

  return r;
}
