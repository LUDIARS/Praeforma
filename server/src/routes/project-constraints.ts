// /api/projects/:pid/constraints — プロジェクトの制約 (spec/feature/project-constraints.md)。
//
// role:
//   - 一覧: プロジェクトメンバー全員
//   - 作成・更新・削除: owner / planner / designer (UX を編集できる人と同じ)
// PF-CON-1 (1 件ずつ・種類・見出し・説明) / PF-CON-2 (版一致で更新・削除、409) / PF-CON-4 (プロジェクトの分離)。
import { Hono } from 'hono';
import { and, asc, eq, isNull, count } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { projectConstraints } from '../db/schema/project-constraint.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { CONSTRAINT_KINDS, CONSTRAINT_LIMITS as L, type ProjectConstraint } from '../../../shared/project-constraint.ts';

const VIEW: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT: readonly ProjectRole[] = ['owner', 'planner', 'designer'];

const fields = {
  kind: z.enum(CONSTRAINT_KINDS),
  // 見出しは 1 行。一覧と UX タブで 1 行に並べるため改行を受け付けない。
  title: z.string().trim().min(1).max(L.title).regex(/^[^\r\n]*$/),
  detail: z.string().trim().max(L.detail).default(''),
};
const createSchema = z.object(fields).strict();
const updateSchema = z.object({ ...fields, expectedRevision: z.number().int().min(1).max(2_147_483_646) }).strict();

type Row = typeof projectConstraints.$inferSelect;
const toConstraint = (r: Row): ProjectConstraint => ({
  id: r.id, kind: r.kind, title: r.title, detail: r.detail, revision: r.revision,
  createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
});
const KIND_ORDER = new Map(CONSTRAINT_KINDS.map((k, i) => [k, i]));

export function makeProjectConstraintRouter(): Hono {
  const router = new Hono();
  router.use('*', requireAuth, requireRole(VIEW));
  router.use('*', async (c, next) => {
    const [p] = await getDb().select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, c.req.param('pid')!), isNull(projects.deletedAt))).limit(1);
    if (!p) throw AppError.notFound('project_not_found');
    await next();
  });

  router.get('/', async (c) => {
    const rows = await getDb().select().from(projectConstraints).where(eq(projectConstraints.projectId, c.req.param('pid')!))
      .orderBy(asc(projectConstraints.createdAt), asc(projectConstraints.id));
    // 種類 (企画 → 技術 → 運用・その他) ごとにまとめ、種類の中は作った順。
    const items = rows.map(toConstraint).sort((a, b) => KIND_ORDER.get(a.kind)! - KIND_ORDER.get(b.kind)!);
    return c.json({ canEdit: EDIT.includes(c.get('projectRole')), items });
  });

  router.post('/', requireRole(EDIT), async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_constraint', parsed.error.flatten());
    const pid = c.req.param('pid')!;
    const [counted] = await getDb().select({ n: count() }).from(projectConstraints).where(eq(projectConstraints.projectId, pid));
    if ((counted?.n ?? 0) >= L.perProject) throw new AppError('constraint_limit_reached', 422);
    const now = new Date(); const identity = getIdentity(c);
    const [row] = await getDb().insert(projectConstraints).values({
      id: ulid(), projectId: pid, ...parsed.data, revision: 1, createdBy: identity.userId, createdAt: now, updatedAt: now,
    }).returning();
    await recordAudit({ projectId: pid, actor: identity, action: 'project_constraint.create', targetKind: 'project_constraint',
      targetId: row!.id, meta: { kind: row!.kind } });
    return c.json({ constraint: toConstraint(row!) }, 201);
  });

  router.put('/:id', requireRole(EDIT), async (c) => {
    const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_constraint', parsed.error.flatten());
    const pid = c.req.param('pid')!; const id = c.req.param('id');
    const { expectedRevision, ...data } = parsed.data;
    const [row] = await getDb().update(projectConstraints)
      .set({ ...data, revision: expectedRevision + 1, updatedAt: new Date() })
      .where(and(eq(projectConstraints.id, id), eq(projectConstraints.projectId, pid), eq(projectConstraints.revision, expectedRevision)))
      .returning();
    if (!row) throw await missingOrConflict(pid, id);
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'project_constraint.update', targetKind: 'project_constraint',
      targetId: id, meta: { revision: row.revision, kind: row.kind } });
    return c.json({ constraint: toConstraint(row) });
  });

  router.delete('/:id', requireRole(EDIT), async (c) => {
    const expected = Number(c.req.query('expectedRevision'));
    if (!Number.isInteger(expected) || expected < 1) throw AppError.badRequest('expected_revision_required');
    const pid = c.req.param('pid')!; const id = c.req.param('id');
    const deleted = await getDb().delete(projectConstraints)
      .where(and(eq(projectConstraints.id, id), eq(projectConstraints.projectId, pid), eq(projectConstraints.revision, expected)))
      .returning({ id: projectConstraints.id });
    if (deleted.length !== 1) throw await missingOrConflict(pid, id);
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'project_constraint.delete', targetKind: 'project_constraint',
      targetId: id, meta: { revision: expected } });
    return c.json({ deleted: true });
  });
  return router;
}

/** 0 件更新の理由を分ける: 別プロジェクト・存在しないなら 404、版が違うなら 409。 */
async function missingOrConflict(projectId: string, id: string): Promise<AppError> {
  const [current] = await getDb().select({ id: projectConstraints.id }).from(projectConstraints)
    .where(and(eq(projectConstraints.id, id), eq(projectConstraints.projectId, projectId))).limit(1);
  return current ? AppError.conflict('constraint_revision_conflict') : AppError.notFound('constraint_not_found');
}
