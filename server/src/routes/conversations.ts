// /api/projects/:pid/conversations — LLM トークエリア (feature/screen-flow.md §5.4)。
//
//   GET  /?target_kind=&target_id=                … 会話取得 (無ければ空)
//   POST /:cid/messages                            … ユーザ発話 → LLM 応答 (同期、 120s)
//   POST /:cid/messages/:mid/apply { indices[] }   … proposals の選択反映
//
// 会話は対象 1 つにつき 1 本。 最初の発話で自動作成する (POST /  { target_kind, target_id, message })。
//
// @spec 5.4 API

import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { domains } from '../db/schema/domain.ts';
import { layouts, layoutObjects } from '../db/schema/layout.ts';
import { objects } from '../db/schema/object.ts';
import {
  specConversations,
  specMessages,
  transitions,
  type ConversationTargetKind,
  type Proposal,
} from '../db/schema/screen-flow.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { chatOnce } from '../lib/llm.ts';
import { loadExportModel } from '../lib/export/load-model.ts';
import type { ExportModel } from '../lib/export/model.ts';
import {
  buildConversationPrompt,
  normalizeReply,
  type AnatomiaStatus,
  type ConversationReply,
  type ConversationTarget,
} from '../lib/conversation-prompt.ts';
import { fetchAnatomiaDomains, type AnatomiaDomain, type AnatomiaDomainsOptions } from '../lib/anatomia-domains.ts';
import { applyProposals } from '../lib/apply-proposals.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

const targetKindSchema = z.enum(['project', 'domain', 'layout', 'object', 'transition']);
const startSchema = z.object({
  target_kind: targetKindSchema,
  target_id: z.string().min(1),
  message: z.string().min(1).max(8000),
});
const messageSchema = z.object({ message: z.string().min(1).max(8000) });
const applySchema = z.object({ indices: z.array(z.number().int().min(0)).min(1).max(50) });

async function resolveTarget(pid: string, kind: ConversationTargetKind, id: string): Promise<ConversationTarget> {
  const db = getDb();
  if (kind === 'project') {
    const [p] = await db.select().from(projects).where(eq(projects.id, pid)).limit(1);
    if (!p) throw AppError.notFound('project_not_found');
    return { kind, id: pid, name: p.name, description: p.description };
  }
  if (kind === 'domain') {
    const [d] = await db.select().from(domains).where(and(eq(domains.id, id), eq(domains.projectId, pid))).limit(1);
    if (!d) throw AppError.notFound('domain_not_found');
    return { kind, id, name: d.name, description: d.description };
  }
  if (kind === 'layout') {
    const [l] = await db.select().from(layouts).where(and(eq(layouts.id, id), eq(layouts.projectId, pid))).limit(1);
    if (!l) throw AppError.notFound('layout_not_found');
    return { kind, id, name: l.name, description: l.description };
  }
  if (kind === 'object') {
    // id は layout_objects.id (画面上の配置)
    const [p] = await db.select().from(layoutObjects).where(eq(layoutObjects.id, id)).limit(1);
    if (!p) throw AppError.notFound('placement_not_found');
    const [o] = await db.select().from(objects).where(and(eq(objects.id, p.objectId), eq(objects.projectId, pid))).limit(1);
    if (!o) throw AppError.notFound('object_not_found');
    return { kind, id, name: o.label, description: null };
  }
  const [t] = await db.select().from(transitions).where(and(eq(transitions.id, id), eq(transitions.projectId, pid))).limit(1);
  if (!t) throw AppError.notFound('transition_not_found');
  return { kind, id, name: t.label ?? `${t.trigger}${t.condition ? ` / ${t.condition}` : ''}`, description: null };
}

/**
 * 対象に効く Anatomia ドメイン名を決める。 画面 / UI 要素 / 遷移は自分ではドメインを持たないので、
 * 所属画面のドメイン (load-model が多数決で決めたもの) に従う (§5.2-2)。
 */
function targetAnatomiaName(model: ExportModel, target: ConversationTarget): string | null {
  switch (target.kind) {
    case 'domain':
      return model.domains.find((d) => d.id === target.id)?.anatomiaDomain ?? null;
    case 'layout':
      return model.screens.find((s) => s.id === target.id)?.anatomiaDomain ?? null;
    case 'object':
      return (
        model.screens.find((s) => s.widgets.some((w) => w.placementId === target.id))?.anatomiaDomain ?? null
      );
    case 'transition': {
      const t = model.transitions.find((x) => x.id === target.id);
      return t ? (model.screens.find((s) => s.id === t.fromLayoutId)?.anatomiaDomain ?? null) : null;
    }
    default:
      return null;
  }
}

/** 対象ドメインの Anatomia 定義を引く。 未設定 / 未連携 / 取得不能は状態だけ返す (mock 禁止)。 */
async function resolveAnatomia(
  opts: AnatomiaDomainsOptions,
  pid: string,
  model: ExportModel,
  target: ConversationTarget,
): Promise<{ status: AnatomiaStatus; domain: AnatomiaDomain | null }> {
  if (!opts.anatomiaUrl) return { status: 'unconfigured', domain: null };
  const [p] = await getDb().select({ repo: projects.anatomiaRepo }).from(projects).where(eq(projects.id, pid)).limit(1);
  if (!p?.repo) return { status: 'unconfigured', domain: null };
  const anatomiaName = targetAnatomiaName(model, target);
  if (!anatomiaName) return { status: 'unlinked', domain: null };
  try {
    const catalog = await fetchAnatomiaDomains(opts, p.repo);
    const found = catalog.find((d) => d.name === anatomiaName) ?? null;
    return { status: found ? 'linked' : 'unlinked', domain: found };
  } catch (e) {
    // 取得失敗を「未設定」と偽らない (設定の事実として LLM に伝わってしまう)。
    console.warn(`[anatomia] domain-view fetch failed (${p.repo}): ${String(e)}`);
    return { status: 'unavailable', domain: null };
  }
}

async function runTurn(
  claudeBin: string,
  anatomiaOpts: AnatomiaDomainsOptions,
  pid: string,
  conversationId: string,
  target: ConversationTarget,
  userMessage: string,
): Promise<{ userId: string; assistantId: string; content: string; proposals: Proposal[] }> {
  const db = getDb();
  const history = await db
    .select()
    .from(specMessages)
    .where(eq(specMessages.conversationId, conversationId))
    .orderBy(asc(specMessages.createdAt));
  const userId = ulid();
  await db.insert(specMessages).values({ id: userId, conversationId, role: 'user', content: userMessage, proposals: [] });

  let reply: ConversationReply;
  try {
    const model = await loadExportModel(pid);
    const anat = await resolveAnatomia(anatomiaOpts, pid, model, target);
    const prompt = buildConversationPrompt({
      model,
      target,
      anatomiaDomain: anat.domain,
      anatomiaStatus: anat.status,
      history: history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      userMessage,
    });
    const { raw, text } = await chatOnce(claudeBin, prompt);
    reply = normalizeReply(raw, text);
  } catch (e) {
    // 返答を得られなかった往復は履歴に残さない (次回プロンプトが片側だけの会話になる)。
    try {
      await db.delete(specMessages).where(eq(specMessages.id, userId));
    } catch {
      /* best effort */
    }
    throw e;
  }
  const assistantId = ulid();
  await db.insert(specMessages).values({
    id: assistantId,
    conversationId,
    role: 'assistant',
    content: reply.content,
    proposals: reply.proposals,
  });
  await db.update(specConversations).set({ updatedAt: new Date() }).where(eq(specConversations.id, conversationId));
  return { userId, assistantId, content: reply.content, proposals: reply.proposals };
}

export function makeConversationRouter(claudeBin: string, anatomiaOpts: AnatomiaDomainsOptions): Hono {
  const r = new Hono();

  r.get('/', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const kind = targetKindSchema.safeParse(c.req.query('target_kind'));
    const tid = c.req.query('target_id');
    if (!kind.success || !tid) throw AppError.badRequest('target_required');
    const [conv] = await getDb()
      .select()
      .from(specConversations)
      .where(and(eq(specConversations.projectId, pid), eq(specConversations.targetKind, kind.data), eq(specConversations.targetId, tid)))
      .limit(1);
    if (!conv) return c.json({ conversation: null, messages: [] });
    const messages = await getDb()
      .select()
      .from(specMessages)
      .where(eq(specMessages.conversationId, conv.id))
      .orderBy(asc(specMessages.createdAt));
    return c.json({ conversation: conv, messages });
  });

  // 最初の発話: 会話を (無ければ) 作って 1 往復
  r.post('/', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const parsed = startSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const target = await resolveTarget(pid, parsed.data.target_kind, parsed.data.target_id);
    const identity = getIdentity(c);
    let [conv] = await getDb()
      .select()
      .from(specConversations)
      .where(and(eq(specConversations.projectId, pid), eq(specConversations.targetKind, target.kind), eq(specConversations.targetId, target.id)))
      .limit(1);
    if (!conv) {
      const cid = ulid();
      await getDb().insert(specConversations).values({
        id: cid,
        projectId: pid,
        targetKind: target.kind,
        targetId: target.id,
        title: target.name,
        createdBy: identity.userId,
      });
      [conv] = await getDb().select().from(specConversations).where(eq(specConversations.id, cid)).limit(1);
      await recordAudit({ projectId: pid, actor: identity, action: 'conversation.create', targetKind: 'conversation', targetId: cid, meta: { target } });
    }
    const turn = await runTurn(claudeBin, anatomiaOpts, pid, conv!.id, target, parsed.data.message);
    return c.json({ conversation: conv, ...turn }, 201);
  });

  r.post('/:cid/messages', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const cid = c.req.param('cid')!;
    const parsed = messageSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const [conv] = await getDb()
      .select()
      .from(specConversations)
      .where(and(eq(specConversations.id, cid), eq(specConversations.projectId, pid)))
      .limit(1);
    if (!conv) throw AppError.notFound('conversation_not_found');
    const target = await resolveTarget(pid, conv.targetKind, conv.targetId);
    const turn = await runTurn(claudeBin, anatomiaOpts, pid, cid, target, parsed.data.message);
    return c.json(turn, 201);
  });

  r.post('/:cid/messages/:mid/apply', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const cid = c.req.param('cid')!;
    const mid = c.req.param('mid')!;
    const parsed = applySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const [conv] = await getDb()
      .select()
      .from(specConversations)
      .where(and(eq(specConversations.id, cid), eq(specConversations.projectId, pid)))
      .limit(1);
    if (!conv) throw AppError.notFound('conversation_not_found');
    const [msg] = await getDb().select().from(specMessages).where(and(eq(specMessages.id, mid), eq(specMessages.conversationId, cid))).limit(1);
    if (!msg) throw AppError.notFound('message_not_found');
    if (msg.role !== 'assistant') throw AppError.badRequest('not_assistant_message');
    const identity = getIdentity(c);
    // 反映済みの提案は再実行しない (二重作成防止、 §5.3)。 状態は proposals[].applied に残す。
    // applied は反映後にまとめて書くので、 同一リクエスト内の重複 index は先に潰す
    // (indices=[0,0] だと同じ提案が 2 回作られてしまう)。
    const stored = (msg.proposals ?? []) as Proposal[];
    const requested = [...new Set(parsed.data.indices)];
    const skipped = requested.filter((i) => stored[i]?.applied === true);
    const pending = requested.filter((i) => stored[i]?.applied !== true);
    const result = await applyProposals(pid, identity.userId, stored, pending);
    if (result.applied.length > 0) {
      const appliedIdx = new Set(result.applied.map((a) => a.index));
      const next: Proposal[] = stored.map((p, i) => (appliedIdx.has(i) ? { ...p, applied: true } : p));
      await getDb()
        .update(specMessages)
        .set({ proposals: next, applied: true })
        .where(eq(specMessages.id, mid));
    }
    await recordAudit({
      projectId: pid,
      actor: identity,
      action: 'conversation.apply',
      targetKind: 'conversation',
      targetId: cid,
      meta: { message_id: mid, ...result, skipped },
    });
    return c.json({ ...result, skipped }, result.failed ? 207 : 200);
  });

  return r;
}
