// /api/projects/:pid/studio — 要件定義モード (Studio)。
//
// フロー (ユーザ UX):
//   1. (任意) 資料を ingest → ドラフトのドメイン/シーン/要件を提案
//   2. メニュー (ドメイン新規/調整・シーン新規/調整) は既存 domains/layouts CRUD に乗る
//   3. /suggest で LLM (claude -p) から要件+回帰テストを提案 → 確定は既存 /specs で作成
//   4. /anatomia-link で MUSA(Thaleia) 経由 Anatomia にリレー → code graph を更新
//   5. graph CRUD で調整
//
// role: 参照は全ロール、 変更/サジェスト/リンクは owner/planner (= プランナーの仕事)。

import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { domains } from '../db/schema/domain.ts';
import { layouts } from '../db/schema/layout.ts';
import { specs, specTargets, specAcceptance } from '../db/schema/spec.ts';
import {
  codeGraphNodes,
  codeGraphEdges,
  codeGraphRuns,
  type GraphTargetKind,
} from '../db/schema/code-graph.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { suggestRequirements, ingestDocuments } from '../lib/llm.ts';
import { relayAnatomia, type MusaRelayOptions } from '../lib/musa-relay.ts';

const ALL_ROLES: readonly ProjectRole[] = [
  'owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer',
];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

/** UX 上の target 種別 (scene) を DB/graph 上の種別 (layout) に対応付ける。 */
type UxKind = 'domain' | 'scene';
function toGraphKind(k: UxKind): GraphTargetKind {
  return k === 'scene' ? 'layout' : 'domain';
}

async function getProjectName(pid: string): Promise<string> {
  const [row] = await getDb()
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, pid))
    .limit(1);
  return row?.name ?? pid;
}

/** UX kind に応じて domain / layout(scene) の名前・概要を解決する。 */
async function resolveTarget(
  pid: string,
  kind: UxKind,
  id: string,
): Promise<{ name: string; description: string | null }> {
  if (kind === 'domain') {
    const [row] = await getDb()
      .select({ name: domains.name, description: domains.description })
      .from(domains)
      .where(and(eq(domains.projectId, pid), eq(domains.id, id)))
      .limit(1);
    if (!row) throw AppError.notFound('domain_not_found');
    return row;
  }
  const [row] = await getDb()
    .select({ name: layouts.name, description: layouts.description })
    .from(layouts)
    .where(and(eq(layouts.projectId, pid), eq(layouts.id, id)))
    .limit(1);
  if (!row) throw AppError.notFound('scene_not_found');
  return row;
}

/** 対象 (domain/scene) に紐付く要件 (spec) を acceptance 文込みで取得。 */
async function loadRequirementsForTarget(pid: string, graphKind: GraphTargetKind, id: string) {
  const targets = await getDb()
    .select({ specId: specTargets.specId })
    .from(specTargets)
    .where(and(eq(specTargets.kind, graphKind), eq(specTargets.refId, id)));
  const specIds = targets.map((t) => t.specId);
  if (specIds.length === 0) return [];
  const rows = await getDb()
    .select()
    .from(specs)
    .where(and(eq(specs.projectId, pid), inArray(specs.id, specIds), isNull(specs.deletedAt)));
  const acc = await getDb()
    .select()
    .from(specAcceptance)
    .where(inArray(specAcceptance.specId, specIds))
    .orderBy(asc(specAcceptance.ordinal));
  return rows.map((s) => ({
    code: s.code,
    title: s.title,
    description: s.description,
    priority: s.priority,
    category: s.category,
    acceptance: acc.filter((a) => a.specId === s.id).map((a) => a.text),
  }));
}

const targetSchema = z.object({
  target_kind: z.enum(['domain', 'scene']),
  target_id: z.string().min(1),
});

const ingestSchema = z.object({
  material: z.string().min(1).max(50_000),
  kind: z.enum(['spec-doc', 'screen-list', 'anatomia-result', 'other']).optional(),
});

const suggestSchema = targetSchema.extend({
  note: z.string().max(4000).optional(),
});

const linkSchema = targetSchema.extend({
  query: z.string().max(2000).optional(),
  repo: z.string().max(500).optional(),
});

export function makeStudioRouter(relay: MusaRelayOptions, claudeBin: string): Hono {
  const r = new Hono();

  // ── 1. ingest: 資料 → ドラフト提案 (永続化しない) ──────────────────────
  r.post('/ingest', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = ingestSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const projectName = await getProjectName(pid);
    const proposal = await ingestDocuments(claudeBin, {
      projectName,
      material: parsed.data.material,
      kind: parsed.data.kind ?? 'other',
    });
    return c.json({ proposal });
  });

  // ── 3. suggest: LLM から要件+回帰テストを提案 ─────────────────────────
  r.post('/suggest', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = suggestSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const target = await resolveTarget(pid, parsed.data.target_kind, parsed.data.target_id);
    const projectName = await getProjectName(pid);
    const existing = await loadRequirementsForTarget(
      pid,
      toGraphKind(parsed.data.target_kind),
      parsed.data.target_id,
    );
    const { requirements } = await suggestRequirements(claudeBin, {
      projectName,
      targetKind: parsed.data.target_kind,
      targetName: target.name,
      targetDescription: target.description ?? undefined,
      existingTitles: existing.map((e) => e.title),
      note: parsed.data.note,
    });
    return c.json({ requirements });
  });

  // ── 4. anatomia-link: MUSA(Thaleia) 経由でグラフ取得 → upsert ──────────
  r.post('/anatomia-link', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const graphKind = toGraphKind(parsed.data.target_kind);
    const target = await resolveTarget(pid, parsed.data.target_kind, parsed.data.target_id);
    const projectName = await getProjectName(pid);
    const reqs = await loadRequirementsForTarget(pid, graphKind, parsed.data.target_id);
    const query = parsed.data.query ?? `${target.name} の関連処理`;
    const id = getIdentity(c);

    // MUSA リレー (未設定/失敗は明示エラー)。 失敗時も run を error で残す。
    let result;
    try {
      result = await relayAnatomia(relay, {
        project: projectName,
        target: {
          kind: graphKind,
          id: parsed.data.target_id,
          name: target.name,
          description: target.description,
        },
        requirements: reqs,
        query,
        repo: parsed.data.repo,
      });
    } catch (e) {
      const status = e instanceof AppError && e.message === 'musa_relay_unconfigured'
        ? 'musa_unconfigured'
        : 'error';
      await getDb().insert(codeGraphRuns).values({
        id: ulid(),
        projectId: pid,
        targetKind: graphKind,
        targetId: parsed.data.target_id,
        query,
        status,
        summary: e instanceof AppError ? e.message : String(e),
        raw: e instanceof AppError ? (e.detail as Record<string, unknown>) ?? {} : {},
        requestedBy: id.userId,
      });
      throw e;
    }

    // node upsert (既存 node_key は label/ref を更新、 user の dismissed status は保持)
    const keyToId = new Map<string, string>();
    for (const n of result.nodes) {
      const [exist] = await getDb()
        .select({ id: codeGraphNodes.id })
        .from(codeGraphNodes)
        .where(
          and(
            eq(codeGraphNodes.projectId, pid),
            eq(codeGraphNodes.targetKind, graphKind),
            eq(codeGraphNodes.targetId, parsed.data.target_id),
            eq(codeGraphNodes.nodeKey, n.key),
          ),
        )
        .limit(1);
      if (exist) {
        await getDb()
          .update(codeGraphNodes)
          .set({ label: n.label, anatomiaRef: n.anatomia_ref ?? {}, updatedAt: new Date() })
          .where(eq(codeGraphNodes.id, exist.id));
        keyToId.set(n.key, exist.id);
      } else {
        const nid = ulid();
        await getDb().insert(codeGraphNodes).values({
          id: nid,
          projectId: pid,
          targetKind: graphKind,
          targetId: parsed.data.target_id,
          nodeKey: n.key,
          label: n.label,
          nodeType: n.type ?? 'symbol',
          anatomiaRef: n.anatomia_ref ?? {},
          source: 'anatomia',
          status: 'linked',
        });
        keyToId.set(n.key, nid);
      }
    }

    // edge upsert (key 参照を解決、 不明 key はスキップ)
    let edgeCount = 0;
    for (const e of result.edges) {
      const from = keyToId.get(e.from);
      const to = keyToId.get(e.to);
      if (!from || !to) continue;
      await getDb()
        .insert(codeGraphEdges)
        .values({
          id: ulid(),
          projectId: pid,
          targetKind: graphKind,
          targetId: parsed.data.target_id,
          fromNode: from,
          toNode: to,
          relation: e.relation ?? 'related',
          source: 'anatomia',
        })
        .onConflictDoNothing();
      edgeCount += 1;
    }

    const runId = ulid();
    await getDb().insert(codeGraphRuns).values({
      id: runId,
      projectId: pid,
      targetKind: graphKind,
      targetId: parsed.data.target_id,
      query,
      status: 'ok',
      nodeCount: result.nodes.length,
      edgeCount,
      summary: result.summary ?? null,
      raw: result as unknown as Record<string, unknown>,
      requestedBy: id.userId,
    });
    await recordAudit({
      projectId: pid,
      actor: id,
      action: 'studio.anatomia_link',
      targetKind: graphKind,
      targetId: parsed.data.target_id,
      meta: { nodes: result.nodes.length, edges: edgeCount },
    });

    const graph = await loadGraph(pid, graphKind, parsed.data.target_id);
    return c.json({ run_id: runId, summary: result.summary ?? null, ...graph });
  });

  // ── 5. graph: 取得 + 調整 ──────────────────────────────────────────────
  r.get('/graph', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const kind = c.req.query('target_kind');
    const tid = c.req.query('target_id');
    if ((kind !== 'domain' && kind !== 'scene') || !tid) {
      throw AppError.badRequest('target_kind (domain|scene) と target_id が必要です');
    }
    const graphKind = toGraphKind(kind);
    const graph = await loadGraph(pid, graphKind, tid);
    const [latest] = await getDb()
      .select()
      .from(codeGraphRuns)
      .where(
        and(
          eq(codeGraphRuns.projectId, pid),
          eq(codeGraphRuns.targetKind, graphKind),
          eq(codeGraphRuns.targetId, tid),
        ),
      )
      .orderBy(desc(codeGraphRuns.createdAt))
      .limit(1);
    return c.json({ ...graph, latest_run: latest ? serializeRun(latest) : null });
  });

  const nodePatchSchema = z.object({
    status: z.enum(['linked', 'candidate', 'dismissed']).optional(),
    label: z.string().min(1).max(300).optional(),
    meta: z.record(z.unknown()).optional(),
  });

  r.patch('/graph/nodes/:nid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const nid = c.req.param('nid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = nodePatchSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.label !== undefined) patch.label = parsed.data.label;
    if (parsed.data.meta !== undefined) patch.meta = parsed.data.meta;
    await getDb().update(codeGraphNodes).set(patch).where(eq(codeGraphNodes.id, nid));
    const [row] = await getDb().select().from(codeGraphNodes).where(eq(codeGraphNodes.id, nid)).limit(1);
    if (!row) throw AppError.notFound();
    return c.json({ node: serializeNode(row) });
  });

  const nodeCreateSchema = targetSchema.extend({
    label: z.string().min(1).max(300),
    node_key: z.string().min(1).max(300).optional(),
    node_type: z.enum(['symbol', 'file', 'domain', 'spec', 'external']).optional(),
  });

  r.post('/graph/nodes', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = nodeCreateSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const graphKind = toGraphKind(parsed.data.target_kind);
    const nid = ulid();
    await getDb().insert(codeGraphNodes).values({
      id: nid,
      projectId: pid,
      targetKind: graphKind,
      targetId: parsed.data.target_id,
      nodeKey: parsed.data.node_key ?? `manual:${nid}`,
      label: parsed.data.label,
      nodeType: parsed.data.node_type ?? 'external',
      source: 'manual',
      status: 'linked',
    });
    const [row] = await getDb().select().from(codeGraphNodes).where(eq(codeGraphNodes.id, nid)).limit(1);
    if (!row) throw AppError.internal('node_create_failed');
    return c.json({ node: serializeNode(row) }, 201);
  });

  r.delete('/graph/nodes/:nid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const nid = c.req.param('nid')!;
    // 端の edge を先に削除 (FK)
    await getDb().delete(codeGraphEdges).where(eq(codeGraphEdges.fromNode, nid));
    await getDb().delete(codeGraphEdges).where(eq(codeGraphEdges.toNode, nid));
    await getDb().delete(codeGraphNodes).where(eq(codeGraphNodes.id, nid));
    return c.json({ ok: true });
  });

  const edgeCreateSchema = targetSchema.extend({
    from_node: z.string().min(1),
    to_node: z.string().min(1),
    relation: z.enum(['calls', 'depends', 'implements', 'related']).optional(),
  });

  r.post('/graph/edges', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = edgeCreateSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const graphKind = toGraphKind(parsed.data.target_kind);
    const eid = ulid();
    await getDb()
      .insert(codeGraphEdges)
      .values({
        id: eid,
        projectId: pid,
        targetKind: graphKind,
        targetId: parsed.data.target_id,
        fromNode: parsed.data.from_node,
        toNode: parsed.data.to_node,
        relation: parsed.data.relation ?? 'related',
        source: 'manual',
      })
      .onConflictDoNothing();
    return c.json({ ok: true }, 201);
  });

  r.delete('/graph/edges/:eid', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const eid = c.req.param('eid')!;
    await getDb().delete(codeGraphEdges).where(eq(codeGraphEdges.id, eid));
    return c.json({ ok: true });
  });

  return r;
}

// Drizzle は camelCase キーで返すので、 frontend の snake_case 契約に明示変換する。
function serializeNode(n: typeof codeGraphNodes.$inferSelect) {
  return {
    id: n.id,
    project_id: n.projectId,
    target_kind: n.targetKind,
    target_id: n.targetId,
    node_key: n.nodeKey,
    label: n.label,
    node_type: n.nodeType,
    anatomia_ref: n.anatomiaRef,
    source: n.source,
    status: n.status,
    meta: n.meta,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
}

function serializeEdge(e: typeof codeGraphEdges.$inferSelect) {
  return {
    id: e.id,
    project_id: e.projectId,
    target_kind: e.targetKind,
    target_id: e.targetId,
    from_node: e.fromNode,
    to_node: e.toNode,
    relation: e.relation,
    source: e.source,
    created_at: e.createdAt,
  };
}

function serializeRun(r: typeof codeGraphRuns.$inferSelect) {
  return {
    id: r.id,
    project_id: r.projectId,
    target_kind: r.targetKind,
    target_id: r.targetId,
    query: r.query,
    status: r.status,
    node_count: r.nodeCount,
    edge_count: r.edgeCount,
    summary: r.summary,
    created_at: r.createdAt,
  };
}

async function loadGraph(pid: string, graphKind: GraphTargetKind, tid: string) {
  const nodes = await getDb()
    .select()
    .from(codeGraphNodes)
    .where(
      and(
        eq(codeGraphNodes.projectId, pid),
        eq(codeGraphNodes.targetKind, graphKind),
        eq(codeGraphNodes.targetId, tid),
      ),
    )
    .orderBy(asc(codeGraphNodes.label));
  const edges = await getDb()
    .select()
    .from(codeGraphEdges)
    .where(
      and(
        eq(codeGraphEdges.projectId, pid),
        eq(codeGraphEdges.targetKind, graphKind),
        eq(codeGraphEdges.targetId, tid),
      ),
    );
  return { nodes: nodes.map(serializeNode), edges: edges.map(serializeEdge) };
}
