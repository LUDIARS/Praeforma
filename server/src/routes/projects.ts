// /api/projects + /api/projects/:pid/members
//
// - POST /api/projects               (= 認証済 user なら誰でも作成可、 owner として member 化)
// - GET  /api/projects                (= 自分が member の project 一覧)
// - GET  /api/projects/:pid           (= viewer 以上)
// - PATCH /api/projects/:pid          (= owner)
// - DELETE /api/projects/:pid         (= owner、 ソフトデリート)
// - GET  /api/projects/:pid/members   (= viewer 以上)
// - POST /api/projects/:pid/members   (= owner、 member 追加)
// - PATCH /api/projects/:pid/members/:mid (= owner、 role 変更)
// - DELETE /api/projects/:pid/members/:mid (= owner)

import { Hono } from 'hono';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { projects, projectMembers, type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { parsePagination } from '../lib/pagination.ts';
import { recordAudit } from '../lib/audit.ts';

const ALL_ROLES: readonly ProjectRole[] = [
  'owner',
  'planner',
  'designer',
  'programmer',
  'reviewer',
  'viewer',
];

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  org_id: z.string().min(1),
  platforms: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
  platforms: z.array(z.string()).optional(),
  default_layout_id: z.string().nullish(),
});

const addMemberSchema = z.object({
  user_id: z.string().min(1),
  role: z.enum(['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer']),
  display_name: z.string().max(200).nullish(),
});

const updateMemberSchema = z.object({
  role: z.enum(['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer']),
});

export function makeProjectRouter(): Hono {
  const r = new Hono();

  // list (自分が member の project)
  r.get('/', requireAuth, async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const page = parsePagination(c.req.query());
    const id = getIdentity(c);
    const memberRows = await getDb()
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, id.userId));
    const ids = memberRows.map((r) => r.projectId);
    if (ids.length === 0) {
      return c.json({ items: [], total: 0, limit: page.limit, offset: page.offset });
    }
    const items = await getDb()
      .select()
      .from(projects)
      .where(and(inArray(projects.id, ids), isNull(projects.deletedAt)))
      .orderBy(desc(projects.updatedAt))
      .limit(page.limit)
      .offset(page.offset);
    return c.json({ items, total: ids.length, limit: page.limit, offset: page.offset });
  });

  // single get
  r.get('/:pid', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid');
    if (!pid) throw AppError.badRequest('project_id_required');
    const [row] = await getDb()
      .select()
      .from(projects)
      .where(eq(projects.id, pid))
      .limit(1);
    if (!row) throw AppError.notFound();
    return c.json({ project: row });
  });

  // create — 認証済 user なら誰でも (= owner として自動 member 化)
  r.post('/', requireAuth, async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const id = getIdentity(c);
    const projectId = ulid();
    await getDb()
      .insert(projects)
      .values({
        id: projectId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        orgId: parsed.data.org_id,
        ownerUserId: id.userId,
        platforms: parsed.data.platforms ?? ['web'],
      });
    await getDb()
      .insert(projectMembers)
      .values({
        id: ulid(),
        projectId,
        userId: id.userId,
        role: 'owner',
        displayName: id.displayName,
      });
    await recordAudit({
      projectId,
      actor: id,
      action: 'project.create',
      targetKind: 'project',
      targetId: projectId,
      meta: { name: parsed.data.name, org_id: parsed.data.org_id },
    });
    const [row] = await getDb()
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return c.json({ project: row }, 201);
  });

  // update — owner only
  r.patch('/:pid', requireAuth, requireRole(['owner']), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.platforms !== undefined) patch.platforms = parsed.data.platforms;
    if (parsed.data.default_layout_id !== undefined)
      patch.defaultLayoutId = parsed.data.default_layout_id;

    await getDb().update(projects).set(patch).where(eq(projects.id, pid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'project.update',
      targetKind: 'project',
      targetId: pid,
      meta: parsed.data,
    });
    const [row] = await getDb().select().from(projects).where(eq(projects.id, pid)).limit(1);
    return c.json({ project: row });
  });

  // delete (soft) — owner only
  r.delete('/:pid', requireAuth, requireRole(['owner']), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    await getDb()
      .update(projects)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(projects.id, pid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'project.delete',
      targetKind: 'project',
      targetId: pid,
    });
    return c.json({ ok: true });
  });

  // ── members ────────────────────────────────────────────────────────

  r.get('/:pid/members', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const items = await getDb()
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, pid));
    return c.json({ items });
  });

  r.post('/:pid/members', requireAuth, requireRole(['owner']), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    // 既存重複は CHECK で UNIQUE になるが、 事前 lookup でわかりやすいエラーを返す
    const existing = await getDb()
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, pid),
          eq(projectMembers.userId, parsed.data.user_id),
        ),
      )
      .limit(1);
    if (existing.length > 0) throw AppError.conflict('member_already_exists');

    const mid = ulid();
    await getDb()
      .insert(projectMembers)
      .values({
        id: mid,
        projectId: pid,
        userId: parsed.data.user_id,
        role: parsed.data.role,
        displayName: parsed.data.display_name ?? null,
      });
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'member.add',
      targetKind: 'user',
      targetId: parsed.data.user_id,
      meta: { role: parsed.data.role },
    });
    const [row] = await getDb()
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.id, mid))
      .limit(1);
    return c.json({ member: row }, 201);
  });

  r.patch('/:pid/members/:mid', requireAuth, requireRole(['owner']), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const mid = c.req.param('mid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = updateMemberSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    const [before] = await getDb()
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.id, mid), eq(projectMembers.projectId, pid)))
      .limit(1);
    if (!before) throw AppError.notFound();

    await getDb()
      .update(projectMembers)
      .set({ role: parsed.data.role })
      .where(eq(projectMembers.id, mid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'member.role_change',
      targetKind: 'user',
      targetId: before.userId,
      meta: { from: before.role, to: parsed.data.role },
    });
    const [row] = await getDb()
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.id, mid))
      .limit(1);
    return c.json({ member: row });
  });

  r.delete('/:pid/members/:mid', requireAuth, requireRole(['owner']), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const mid = c.req.param('mid')!;
    const [before] = await getDb()
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.id, mid), eq(projectMembers.projectId, pid)))
      .limit(1);
    if (!before) throw AppError.notFound();
    await getDb().delete(projectMembers).where(eq(projectMembers.id, mid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'member.remove',
      targetKind: 'user',
      targetId: before.userId,
      meta: { role: before.role },
    });
    return c.json({ ok: true });
  });

  return r;
}
