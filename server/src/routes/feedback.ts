// /api/projects/:pid/feedback — シーン上のオブジェクトに対する FB / 仕様コメント。
// Melpomene 互換 (scene_path + world_position + screen_position 持ち)。
//
// v0.1 最小実装: list (filter by layout/object) + create + state 変更 + comments。

import { Hono } from 'hono';
import { and, asc, desc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { objectFeedback, feedbackComments } from '../db/schema/feedback.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { AppError } from '../lib/errors.ts';
import { parsePagination } from '../lib/pagination.ts';

const positionSchema = z.array(z.number()).length(3);
const screenSchema = z.array(z.number()).length(2);

const createSchema = z.object({
  layout_id: z.string().nullish(),
  object_id: z.string().nullish(),
  layout_object_id: z.string().nullish(),
  scene_path: z.string().nullish(),
  world_position: positionSchema.nullish(),
  screen_position: screenSchema.nullish(),
  title: z.string().min(1).max(200),
  body: z.string().max(20000).nullish(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  category: z
    .enum(['bug', 'feature', 'improvement', 'question', 'spec-clarification'])
    .optional(),
  labels: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20000).nullish(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  category: z
    .enum(['bug', 'feature', 'improvement', 'question', 'spec-clarification'])
    .optional(),
  state: z.enum(['open', 'in-progress', 'resolved', 'wont-fix']).optional(),
  labels: z.array(z.string()).optional(),
  assignee_user_id: z.string().nullish(),
});

const commentSchema = z.object({
  body: z.string().min(1).max(20000),
});

export function makeFeedbackRouter(): Hono {
  const r = new Hono();

  // list — query で layout / object / state を絞る
  r.get('/', requireAuth, async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const projectId = c.req.param('pid');
    if (!projectId) throw AppError.badRequest('project_id_required');
    const page = parsePagination(c.req.query());
    const layout = c.req.query('layout');
    const obj = c.req.query('object');
    const layoutObj = c.req.query('layout_object');
    const state = c.req.query('state');

    const conditions = [eq(objectFeedback.projectId, projectId)];
    if (layout) conditions.push(eq(objectFeedback.layoutId, layout));
    if (obj) conditions.push(eq(objectFeedback.objectId, obj));
    if (layoutObj) conditions.push(eq(objectFeedback.layoutObjectId, layoutObj));
    if (state) conditions.push(eq(objectFeedback.state, state));

    const items = await getDb()
      .select()
      .from(objectFeedback)
      .where(and(...conditions))
      .orderBy(desc(objectFeedback.createdAt))
      .limit(page.limit)
      .offset(page.offset);
    return c.json({ items, limit: page.limit, offset: page.offset });
  });

  // single get with comments
  r.get('/:fid', requireAuth, async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const fid = c.req.param('fid');
    if (!fid) throw AppError.badRequest('id_required');
    const [row] = await getDb()
      .select()
      .from(objectFeedback)
      .where(eq(objectFeedback.id, fid))
      .limit(1);
    if (!row) throw AppError.notFound();
    const comments = await getDb()
      .select()
      .from(feedbackComments)
      .where(eq(feedbackComments.feedbackId, fid))
      .orderBy(asc(feedbackComments.createdAt));
    return c.json({ feedback: row, comments });
  });

  // create
  r.post('/', requireAuth, async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const projectId = c.req.param('pid');
    if (!projectId) throw AppError.badRequest('project_id_required');
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const id = getIdentity(c);
    const newId = ulid();
    await getDb()
      .insert(objectFeedback)
      .values({
        id: newId,
        projectId,
        layoutId: parsed.data.layout_id ?? null,
        objectId: parsed.data.object_id ?? null,
        layoutObjectId: parsed.data.layout_object_id ?? null,
        scenePath: parsed.data.scene_path ?? null,
        worldPosition: parsed.data.world_position ?? null,
        screenPosition: parsed.data.screen_position ?? null,
        title: parsed.data.title,
        body: parsed.data.body ?? null,
        priority: parsed.data.priority ?? 'medium',
        category: parsed.data.category ?? 'question',
        labels: parsed.data.labels ?? [],
        createdBy: id.userId,
      });
    const [row] = await getDb()
      .select()
      .from(objectFeedback)
      .where(eq(objectFeedback.id, newId))
      .limit(1);
    return c.json({ feedback: row }, 201);
  });

  // update — title / body / state / priority 等
  r.patch('/:fid', requireAuth, async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const fid = c.req.param('fid');
    if (!fid) throw AppError.badRequest('id_required');
    const body = await c.req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.body !== undefined) patch.body = parsed.data.body;
    if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority;
    if (parsed.data.category !== undefined) patch.category = parsed.data.category;
    if (parsed.data.labels !== undefined) patch.labels = parsed.data.labels;
    if (parsed.data.assignee_user_id !== undefined)
      patch.assigneeUserId = parsed.data.assignee_user_id;
    if (parsed.data.state !== undefined) {
      patch.state = parsed.data.state;
      if (parsed.data.state === 'resolved' || parsed.data.state === 'wont-fix') {
        patch.resolvedAt = new Date();
      } else {
        patch.resolvedAt = null;
      }
    }

    await getDb().update(objectFeedback).set(patch).where(eq(objectFeedback.id, fid));
    const [row] = await getDb()
      .select()
      .from(objectFeedback)
      .where(eq(objectFeedback.id, fid))
      .limit(1);
    if (!row) throw AppError.notFound();
    return c.json({ feedback: row });
  });

  // add comment
  r.post('/:fid/comments', requireAuth, async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const fid = c.req.param('fid');
    if (!fid) throw AppError.badRequest('id_required');
    const body = await c.req.json().catch(() => null);
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const id = getIdentity(c);
    const newId = ulid();
    await getDb()
      .insert(feedbackComments)
      .values({
        id: newId,
        feedbackId: fid,
        userId: id.userId,
        displayName: id.displayName,
        body: parsed.data.body,
      });
    const [row] = await getDb()
      .select()
      .from(feedbackComments)
      .where(eq(feedbackComments.id, newId))
      .limit(1);
    return c.json({ comment: row }, 201);
  });

  return r;
}
