// /api/projects/:pid/cc — Concordia 接続 (feature/screen-flow.md §6)。
//
//   GET  /status           … 設定有無 + cc_links 一覧
//   POST /send             … 確定仕様 (layout / spec / transition) を delegation として送出
//   POST /sync             … 各 run の状態を Cc から取り込む (UI の手動更新。 30s polling は server 側タイマー)
//
// anatomia_domain 未連携の対象は送出を拒否する (400 anatomia_domain_required、 §4.1 enforced)。
//
// @spec 6. Cc 接続

import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { ccLinks, type CcTargetKind } from '../db/schema/screen-flow.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { invokeDelegation, fetchRunStatus, type CcClientOptions } from '../lib/cc-client.ts';
import { loadExportModel } from '../lib/export/load-model.ts';
import { renderSpecMarkdown } from '../lib/export/spec-markdown.ts';
import { sliceSpecForTarget } from '../lib/export/spec-slice.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

// delegation template と cwd は受け取らない: サーバ設定 (PRAEFORMA_CC_TEMPLATE) が正 (§6.3)。
const sendSchema = z.object({
  target_kind: z.enum(['spec', 'layout', 'transition']),
  target_id: z.string().min(1),
  note: z.string().max(4000).optional(),
});

/** 全 link の状態を Cc から取り込む。 route と server タイマーの両方から呼ぶ。 */
export async function syncCcLinks(opts: CcClientOptions, pid?: string): Promise<number> {
  if (!opts.ccUrl || !getDbState().ok) return 0;
  const db = getDb();
  const rows = await db
    .select()
    .from(ccLinks)
    .where(pid ? and(eq(ccLinks.projectId, pid), eq(ccLinks.ccKind, 'delegation_run')) : eq(ccLinks.ccKind, 'delegation_run'));
  let updated = 0;
  for (const l of rows) {
    if (l.status === 'done' || l.status === 'failed') continue;
    try {
      const { status } = await fetchRunStatus(opts, l.ccId);
      await db
        .update(ccLinks)
        .set({ status, lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(ccLinks.id, l.id));
      updated++;
    } catch (e) {
      console.warn(`[cc] sync failed for ${l.ccId}: ${String(e)}`);
    }
  }
  return updated;
}

let globalSyncInFlight = false;

/**
 * server タイマー (30s) 用の全プロジェクト sync。 1 件あたり最大 30s 掛かるので、
 * 前の tick が走っている間は重ねない (溜まると Cc へ多重問い合わせになる)。
 */
export async function syncAllCcLinks(opts: CcClientOptions): Promise<number> {
  if (globalSyncInFlight) return 0;
  globalSyncInFlight = true;
  try {
    return await syncCcLinks(opts);
  } finally {
    globalSyncInFlight = false;
  }
}

export function makeCcRouter(opts: CcClientOptions): Hono {
  const r = new Hono();

  r.get('/status', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const links = await getDb().select().from(ccLinks).where(eq(ccLinks.projectId, pid)).orderBy(desc(ccLinks.createdAt));
    return c.json({ configured: Boolean(opts.ccUrl), template: opts.ccTemplate, links });
  });

  r.post('/send', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    if (!opts.ccUrl) throw new AppError('cc_unconfigured', 503);
    const pid = c.req.param('pid')!;
    const parsed = sendSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const [project] = await getDb().select().from(projects).where(eq(projects.id, pid)).limit(1);
    if (!project) throw AppError.notFound('project_not_found');

    const model = await loadExportModel(pid);
    const slice = sliceSpecForTarget(model, parsed.data.target_kind as CcTargetKind, parsed.data.target_id);
    if (!slice) throw AppError.notFound('target_not_found');
    if (!slice.anatomiaDomain) throw AppError.badRequest('anatomia_domain_required');

    const header = [
      `# Praeforma 実装依頼: ${slice.title}`,
      `- project: ${project.name}`,
      `- anatomia_repo: ${project.anatomiaRepo ?? '-'}`,
      `- anatomia_domain: ${slice.anatomiaDomain}`,
      `- target: ${parsed.data.target_kind}:${parsed.data.target_id}`,
      parsed.data.note ? `- note: ${parsed.data.note}` : '',
      '',
      '実装前に Anatomia supply → 実装 → verify を回すこと。 ドメインは上記 anatomia_domain に属させる。',
      '',
    ].filter((l) => l !== '');
    const extraPrompt = `${header.join('\n')}\n\n${slice.markdown}\n\n---\n全体仕様書 (参考):\n\n${renderSpecMarkdown(model)}`;

    const res = await invokeDelegation(opts, {
      args: {
        project: project.name,
        anatomia_repo: project.anatomiaRepo ?? '',
        anatomia_domain: slice.anatomiaDomain,
        target: `${parsed.data.target_kind}:${parsed.data.target_id}`,
      },
      extraPrompt,
    });
    const id = ulid();
    await getDb().insert(ccLinks).values({
      id,
      projectId: pid,
      targetKind: parsed.data.target_kind,
      targetId: parsed.data.target_id,
      ccKind: 'delegation_run',
      ccId: res.runId,
      status: 'queued',
    });
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'cc.send',
      targetKind: parsed.data.target_kind,
      targetId: parsed.data.target_id,
      meta: { run_id: res.runId, prompt_file_path: res.promptFilePath },
    });
    const [row] = await getDb().select().from(ccLinks).where(eq(ccLinks.id, id)).limit(1);
    return c.json({ link: row, prompt_file_path: res.promptFilePath }, 201);
  });

  r.post('/sync', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    if (!opts.ccUrl) throw new AppError('cc_unconfigured', 503);
    const pid = c.req.param('pid')!;
    const updated = await syncCcLinks(opts, pid);
    const links = await getDb().select().from(ccLinks).where(eq(ccLinks.projectId, pid)).orderBy(desc(ccLinks.createdAt));
    return c.json({ updated, links });
  });

  return r;
}
