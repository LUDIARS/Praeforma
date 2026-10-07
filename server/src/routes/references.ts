// /api/projects/:pid/references — 外部 doc リンク (Notion/Confluence/Google 等)。
//
// v0.1 最小実装: list (by target) + create + delete。
// 認証・project role・対象所属を全操作で検査する。

import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { references, inferReferenceKind } from '../db/schema/reference.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { AppError } from '../lib/errors.ts';
import { requireRole } from '../middleware/require-role.ts';
import { REFERENCE_READ_ROLES, REFERENCE_WRITE_ROLES, referenceScope, requireProjectReference, requireReferenceTarget } from '../lib/reference-access.ts';

const createSchema = z.object({
  target_kind: z.enum(['domain', 'project', 'object', 'spec']),
  target_id: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  kind: z
    .enum(['notion', 'confluence', 'google-docs', 'google-sheet', 'web', 'figma', 'github'])
    .optional(),
  display_mode: z.enum(['link', 'webview', 'markdown']).optional(),
  ordinal: z.number().int().min(0).optional(),
});

const listQuerySchema = z.object({
  target_kind: z.enum(['domain', 'project', 'object', 'spec']),
  target_id: z.string().min(1),
});

export function makeReferenceRouter(): Hono {
  const r = new Hono();

  r.use('*', requireAuth);
  r.get('/', requireRole(REFERENCE_READ_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const projectId = c.req.param('pid');
    if (!projectId) throw AppError.badRequest('project_id_required');
    const parsed = listQuerySchema.safeParse({
      target_kind: c.req.query('target_kind'),
      target_id: c.req.query('target_id'),
    });
    if (!parsed.success) throw AppError.badRequest('bad_query', parsed.error.flatten());
    await requireReferenceTarget(projectId, parsed.data.target_kind, parsed.data.target_id);
    const rows = await getDb()
      .select()
      .from(references)
      .where(
        and(
          eq(references.projectId, projectId),
          eq(references.targetKind, parsed.data.target_kind),
          eq(references.targetId, parsed.data.target_id),
        ),
      )
      .orderBy(asc(references.ordinal), asc(references.createdAt));
    return c.json({ items: rows });
  });

  r.post('/', requireRole(REFERENCE_WRITE_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const projectId = c.req.param('pid');
    if (!projectId) throw AppError.badRequest('project_id_required');
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    await requireReferenceTarget(projectId, parsed.data.target_kind, parsed.data.target_id);
    const id = getIdentity(c);
    const kind = parsed.data.kind ?? inferReferenceKind(parsed.data.url);
    const newId = ulid();
    await getDb()
      .insert(references)
      .values({
        id: newId,
        projectId,
        targetKind: parsed.data.target_kind,
        targetId: parsed.data.target_id,
        kind,
        url: parsed.data.url,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        displayMode: parsed.data.display_mode ?? 'link',
        ordinal: parsed.data.ordinal ?? 0,
        createdBy: id.userId,
      });
    const [row] = await getDb()
      .select()
      .from(references)
      .where(referenceScope(projectId, newId))
      .limit(1);
    return c.json({ reference: row }, 201);
  });

  r.delete('/:rid', requireRole(REFERENCE_WRITE_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const rid = c.req.param('rid');
    if (!rid) throw AppError.badRequest('id_required');
    const projectId = c.req.param('pid');
    if (!projectId) throw AppError.badRequest('project_id_required');
    await requireProjectReference(projectId, rid);
    await getDb().delete(references).where(referenceScope(projectId, rid));
    return c.json({ ok: true });
  });

  return r;
}
