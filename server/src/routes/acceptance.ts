// /api/projects/:pid/acceptance — runs + results。
//
// v1 スコープ:
//   - runs CRUD (start / finish / get / list)
//   - results upsert per (run, acceptance)
//   - manual: text + observed のみ
//   - assertion: expression (JS 式) を server で evaluate せず、 client / runtime
//     probe が評価した結果を POST する (= probe-driven design、 server は集計のみ)
//   - event: スキーマ受信のみ、 評価ロジックは Step 12

import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { acceptanceRuns, acceptanceResults } from '../db/schema/acceptance.ts';
import { type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { parsePagination } from '../lib/pagination.ts';
import { recordAudit } from '../lib/audit.ts';
import { appendEvent, clearEvents, evalPattern, getEvents, type BufferedEvent } from '../lib/event-buffer.ts';
import { specAcceptance } from '../db/schema/spec.ts';

const ALL_ROLES: readonly ProjectRole[] = [
  'owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer',
];
const RUN_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer'];

const startSchema = z.object({
  layout_id: z.string().min(1),
  platform: z.enum(['web', 'unity', 'webgl', '2d-web']),
  trigger: z.enum(['manual', 'file-save', 'cron', 'ci']).optional(),
  seed: z.string().nullish(),
});

const finishSchema = z.object({
  status: z.enum(['passed', 'failed', 'error', 'aborted']),
  summary: z.record(z.string(), z.number()).optional(),
});

const resultSchema = z.object({
  acceptance_id: z.string().min(1),
  status: z.enum(['pass', 'fail', 'skip', 'error']),
  observed: z.unknown().nullish(),
  error_message: z.string().nullish(),
  log_excerpt: z.string().max(4096).nullish(),
  duration_ms: z.number().int().min(0).optional(),
});

const resultsBulkSchema = z.object({
  results: z.array(resultSchema),
});

export function makeAcceptanceRouter(): Hono {
  const r = new Hono();

  r.get('/runs', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const page = parsePagination(c.req.query());
    const status = c.req.query('status');
    const layout = c.req.query('layout');
    const conds = [eq(acceptanceRuns.projectId, pid)];
    if (status) conds.push(eq(acceptanceRuns.status, status));
    if (layout) conds.push(eq(acceptanceRuns.layoutId, layout));
    const items = await getDb()
      .select()
      .from(acceptanceRuns)
      .where(and(...conds))
      .orderBy(desc(acceptanceRuns.startedAt))
      .limit(page.limit)
      .offset(page.offset);
    return c.json({ items, limit: page.limit, offset: page.offset });
  });

  r.get('/runs/:rid', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const rid = c.req.param('rid')!;
    const [run] = await getDb()
      .select()
      .from(acceptanceRuns)
      .where(eq(acceptanceRuns.id, rid))
      .limit(1);
    if (!run) throw AppError.notFound();
    const results = await getDb()
      .select()
      .from(acceptanceResults)
      .where(eq(acceptanceResults.runId, rid));
    return c.json({ run, results });
  });

  // start a run
  r.post('/runs', requireAuth, requireRole(RUN_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const rid = ulid();
    const id = getIdentity(c);
    await getDb()
      .insert(acceptanceRuns)
      .values({
        id: rid,
        projectId: pid,
        layoutId: parsed.data.layout_id,
        platform: parsed.data.platform,
        trigger: parsed.data.trigger ?? 'manual',
        seed: parsed.data.seed ?? null,
        status: 'running',
        triggeredBy: id.userId,
      });
    await recordAudit({
      projectId: pid,
      actor: id,
      action: 'acceptance.run_start',
      targetKind: 'acceptance_run',
      targetId: rid,
      meta: { platform: parsed.data.platform, layout_id: parsed.data.layout_id },
    });
    const [row] = await getDb()
      .select()
      .from(acceptanceRuns)
      .where(eq(acceptanceRuns.id, rid))
      .limit(1);
    return c.json({ run: row }, 201);
  });

  // post results (probe からの結果送信、 1 回で複数受け取れる)
  r.post('/runs/:rid/results', requireAuth, requireRole(RUN_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const rid = c.req.param('rid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = resultsBulkSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    if (parsed.data.results.length > 0) {
      // 既存 (run, acceptance) は上書きしたいので一度削除 → insert (= 単純に upsert)
      for (const r of parsed.data.results) {
        await getDb()
          .delete(acceptanceResults)
          .where(and(
            eq(acceptanceResults.runId, rid),
            eq(acceptanceResults.acceptanceId, r.acceptance_id),
          ));
      }
      await getDb()
        .insert(acceptanceResults)
        .values(
          parsed.data.results.map((r) => ({
            runId: rid,
            acceptanceId: r.acceptance_id,
            status: r.status,
            observed: (r.observed as Record<string, unknown>) ?? null,
            errorMessage: r.error_message ?? null,
            logExcerpt: r.log_excerpt ?? null,
            durationMs: r.duration_ms ?? 0,
          })),
        );
    }
    const rows = await getDb()
      .select()
      .from(acceptanceResults)
      .where(eq(acceptanceResults.runId, rid));
    return c.json({ results: rows });
  });

  // event ingest (Step 12 — runtime probe からの event を per-run ringbuffer に積む)
  const eventSchema = z.object({
    events: z.array(z.object({
      name: z.string().min(1).max(120),
      ts: z.number().int().positive(),
      payload: z.record(z.string(), z.unknown()).optional(),
    })),
  });
  r.post('/runs/:rid/events', requireAuth, requireRole(RUN_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const rid = c.req.param('rid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    for (const ev of parsed.data.events) {
      appendEvent(rid, ev as BufferedEvent);
    }
    return c.json({ count: parsed.data.events.length, buffered: getEvents(rid).length });
  });

  // event-level acceptance を一括評価 (= 通常は finish 直前 / finish と同時に呼ぶ)
  r.post('/runs/:rid/evaluate-events', requireAuth, requireRole(RUN_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const rid = c.req.param('rid')!;
    // event level の acceptance を一覧
    const items = await getDb()
      .select()
      .from(specAcceptance)
      .where(eq(specAcceptance.level, 'event'));
    const buf = getEvents(rid);
    const results: Array<{
      acceptance_id: string;
      status: 'pass' | 'fail' | 'skip' | 'error';
      observed?: Record<string, unknown> | null;
      error_message?: string | null;
    }> = [];
    for (const a of items) {
      if (!a.enabled || !a.expression) {
        results.push({ acceptance_id: a.id, status: 'skip', observed: { reason: 'disabled_or_no_expression' } });
        continue;
      }
      const r = evalPattern(buf, a.expression);
      results.push({
        acceptance_id: a.id,
        status: r.status,
        observed: r.observed ?? null,
        error_message: r.errorMessage ?? null,
      });
    }
    // 評価結果は acceptance_results に保存
    if (results.length > 0) {
      for (const res of results) {
        await getDb()
          .delete(acceptanceResults)
          .where(and(eq(acceptanceResults.runId, rid), eq(acceptanceResults.acceptanceId, res.acceptance_id)));
      }
      await getDb()
        .insert(acceptanceResults)
        .values(results.map((r) => ({
          runId: rid,
          acceptanceId: r.acceptance_id,
          status: r.status,
          observed: r.observed ?? null,
          errorMessage: r.error_message ?? null,
          durationMs: 0,
        })));
    }
    return c.json({ evaluated: results.length, results });
  });

  // finish a run
  r.post('/runs/:rid/finish', requireAuth, requireRole(RUN_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const rid = c.req.param('rid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = finishSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    await getDb()
      .update(acceptanceRuns)
      .set({
        status: parsed.data.status,
        finishedAt: new Date(),
        summary: parsed.data.summary ?? {},
      })
      .where(eq(acceptanceRuns.id, rid));
    // finish 後は ringbuffer を解放
    clearEvents(rid);
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'acceptance.run_finish',
      targetKind: 'acceptance_run',
      targetId: rid,
      meta: { status: parsed.data.status, summary: parsed.data.summary },
    });
    const [row] = await getDb()
      .select()
      .from(acceptanceRuns)
      .where(eq(acceptanceRuns.id, rid))
      .limit(1);
    if (!row) throw AppError.notFound();
    return c.json({ run: row });
  });

  return r;
}
