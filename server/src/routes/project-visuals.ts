// /api/projects/:pid/visuals — ビジュアル素材 (spec/feature/project-visuals.md)。
//
// role:
//   - 一覧・1 枚: プロジェクトメンバー全員
//   - 登録・更新・削除: owner / planner / designer (企画概要書を作れる人と同じ)
// PF-VIS-1 (3 種類・名前・メモ・一押し) / PF-VIS-2 (画像の種類・大きさ・枚数) / PF-VIS-3 (版一致の更新・削除、プロジェクトの分離) /
// PF-VIS-4 (版が使ったものは削除しても画像を残す)。更新・削除は企画概要書の自動更新へ知らせる (PF-CS-11)。
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, eq, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { insertProjectVisual, updateProjectVisual, deleteProjectVisual } from '../db/project-visual-persistence.ts';
import { findProjectVisual, listProjectVisuals, toProjectVisual, toProjectVisualWithImage } from '../db/project-visual-reads.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { decodeSceneImage, DATA_URL_MAX_LENGTH } from '../lib/concept-sheet-input.ts';
import { ignoreMaterialChange, type MaterialChangeListener } from '../lib/concept-sheet-auto-update.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { VISUAL_KINDS, VISUAL_LIMITS as L } from '../../../shared/project-visual.ts';

const VIEW: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT: readonly ProjectRole[] = ['owner', 'planner', 'designer'];

const fields = {
  kind: z.enum(VISUAL_KINDS),
  // 名前は紙面に「現在の画面：名前」として載るので 1 行。
  label: z.string().trim().min(1).max(L.label).regex(/^[^\r\n]*$/),
  note: z.string().trim().max(L.note).default(''),
};
const createSchema = z.object({ ...fields, featured: z.boolean().default(false), dataUrl: z.string().max(DATA_URL_MAX_LENGTH) }).strict();
const updateSchema = z.object({ ...fields, featured: z.boolean(), expectedRevision: z.number().int().min(1).max(2_147_483_646) }).strict();

export function makeProjectVisualRouter(onChange: MaterialChangeListener = ignoreMaterialChange): Hono {
  const router = new Hono();
  router.use('*', requireAuth, requireRole(VIEW));
  router.use('*', async (c, next) => {
    const [p] = await getDb().select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, c.req.param('pid')!), isNull(projects.deletedAt))).limit(1);
    if (!p) throw AppError.notFound('project_not_found');
    await next();
  });

  router.get('/', async (c) => c.json({
    canEdit: EDIT.includes(c.get('projectRole')), max: L.perProject, items: await listProjectVisuals(c.req.param('pid')!),
  }));

  router.get('/:id', async (c) => {
    const row = await findProjectVisual(c.req.param('pid')!, c.req.param('id'));
    if (!row) throw AppError.notFound('visual_not_found');
    return c.json({ visual: toProjectVisualWithImage(row) });
  });

  router.post('/', requireRole(EDIT), bodyLimit({
    maxSize: DATA_URL_MAX_LENGTH + 16 * 1024, onError: () => { throw new AppError('scene_image_too_large', 413); },
  }), async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_visual', parsed.error.flatten());
    const pid = c.req.param('pid')!; const identity = getIdentity(c);
    const { image, bytes } = decodeSceneImage(parsed.data.label, parsed.data.dataUrl);
    const id = ulid();
    await insertProjectVisual({ id, projectId: pid, kind: parsed.data.kind, label: parsed.data.label, note: parsed.data.note,
      featured: parsed.data.featured, image: { ...image, byteSize: bytes.byteLength }, createdBy: identity.userId });
    await recordAudit({ projectId: pid, actor: identity, action: 'project_visual.create', targetKind: 'project_visual', targetId: id,
      meta: { kind: parsed.data.kind, bytes: bytes.byteLength } });
    const row = await findProjectVisual(pid, id);
    if (!row) throw AppError.internal('visual_not_saved');
    return c.json({ visual: toProjectVisual(row) }, 201);
  });

  router.put('/:id', requireRole(EDIT), async (c) => {
    const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_visual', parsed.error.flatten());
    const pid = c.req.param('pid')!; const id = c.req.param('id');
    const { expectedRevision, ...data } = parsed.data;
    await updateProjectVisual(id, pid, data, expectedRevision);
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'project_visual.update', targetKind: 'project_visual',
      targetId: id, meta: { revision: expectedRevision + 1, kind: data.kind, featured: data.featured } });
    onChange(pid);
    const row = await findProjectVisual(pid, id);
    if (!row) throw AppError.notFound('visual_not_found');
    return c.json({ visual: toProjectVisual(row) });
  });

  router.delete('/:id', requireRole(EDIT), async (c) => {
    const expected = Number(c.req.query('expectedRevision'));
    if (!Number.isInteger(expected) || expected < 1) throw AppError.badRequest('expected_revision_required');
    const pid = c.req.param('pid')!; const id = c.req.param('id');
    const mode = await deleteProjectVisual(id, pid, expected);
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'project_visual.delete', targetKind: 'project_visual',
      targetId: id, meta: { revision: expected, keptForVersions: mode === 'soft' } });
    onChange(pid);
    return c.json({ deleted: true });
  });
  return router;
}
