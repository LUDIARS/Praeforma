import { Hono } from 'hono';
import { makeDefinitionTodosRouter } from './ux-definition-todos.ts';
import { bodyLimit } from 'hono/body-limit';
import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { getDb, getDbState } from '../db/connection.ts';
import { completeBoundaryAnalysis, createScenarioWithCanvas } from '../db/ux-design-persistence.ts';
import {
  uxAnalysisRuns,
  uxBoundaryDecisions,
  uxBoundaryProposals,
  uxCanvases,
  uxEvidence,
  uxImageAnalyses,
  uxScenarios,
  uxUseCases,
  type BoundarySnapshot,
  type CanvasElement,
  type CanvasFrame,
  type CanvasTransition,
} from '../db/schema/ux-design.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { fetchDomainOrganization } from '../lib/anatomia-domain-organization.ts';
import { fetchStudioGraph, type AnatomiaGraphOptions } from '../lib/anatomia-graph/client.ts';
import { AppError } from '../lib/errors.ts';
import { isGeniusEnabled, publishGeniusDecision, queryGenius, type GeniusOptions } from '../lib/genius-client.ts';
import { analyzeLayoutImage, type ImageLayoutCandidate } from '../lib/ux-image-analysis.ts';
import {
  analyzeUxBoundaries,
  assessCandidatesWithGenius,
  geniusQueryText,
} from '../lib/ux-boundary-analysis.ts';
import { recordAudit } from '../lib/audit.ts';
import {
  analysisSchema,
  anatomiaEvidenceSchema,
  canvasSchema,
  createScenarioSchema,
  createUseCaseSchema,
  decisionSchema,
  type DecisionInput,
  evidenceSchema,
  imageApplySchema,
  parse,
  updateScenarioSchema,
  updateUseCaseSchema,
} from './ux-design-contracts.ts';
import { currentCanvas, readWorkspace, scenarioInProject } from './ux-design-workspace.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer'];
const REVIEW_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'reviewer'];
/** 画像本体の上限。 `analyzeLayoutImage` の検証と同じ値を使う。 */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** multipart の envelope 分を足した request 全体の上限。 */
const MAX_IMAGE_REQUEST_BYTES = MAX_IMAGE_BYTES + 1024 * 1024;

function errorCode(error: unknown): string {
  return error instanceof AppError ? error.message : 'ux_analysis_failed';
}

/**
 * 失敗記録そのものが失敗しても元の原因を握り潰さない。 記録できなければ run は
 * `running` のまま残るので、 原因を辿れるようログにだけ残して元の error を投げ直す。
 */
async function recordRunFailure(work: Promise<unknown>, analysisId: string): Promise<void> {
  try {
    await work;
  } catch (e) {
    console.error(`[ux-design] failed to mark run ${analysisId} as error: ${String(e)}`);
  }
}

function isUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; cause?: unknown };
  return value.code === '23505'
    || value.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || (value.cause !== error && isUniqueConflict(value.cause));
}

function asBoundarySnapshots(
  data: DecisionInput,
  proposal: typeof uxBoundaryProposals.$inferSelect,
): BoundarySnapshot[] {
  return data.result_boundaries.map((boundary) => ({
    name: boundary.name,
    responsibility: boundary.responsibility,
    classification: boundary.classification ?? proposal.classification,
    in_scope: boundary.in_scope,
    out_of_scope: boundary.out_of_scope,
    rules: boundary.rules,
    ubiquitous_language: boundary.ubiquitous_language,
    interactions: boundary.interactions,
    use_case_ids: boundary.use_case_ids,
  }));
}

export function makeUxDesignRouter(options: {
  claudeBin: string;
  anatomia: AnatomiaGraphOptions;
  genius: GeniusOptions;
}): Hono {
  const r = new Hono();
  r.route('/', makeDefinitionTodosRouter(options.anatomia));

  r.get('/scenarios', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const items = await getDb().select().from(uxScenarios)
      .where(eq(uxScenarios.projectId, pid)).orderBy(desc(uxScenarios.updatedAt));
    return c.json({ items });
  });

  r.post('/scenarios', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const data = parse(createScenarioSchema, await c.req.json().catch(() => null));
    const actor = getIdentity(c);
    const id = ulid();
    await createScenarioWithCanvas({
      id,
      projectId: pid,
      name: data.name,
      actor: data.actor,
      context: data.context,
      goal: data.goal,
      successOutcome: data.successOutcome,
      sourceProjectKey: data.sourceProjectKey ?? null,
      sourceRefs: data.sourceRefs,
      createdBy: actor.userId,
    }, { scenarioId: id, revision: 1, updatedBy: actor.userId });
    await recordAudit({ projectId: pid, actor, action: 'ux_scenario.create', targetKind: 'ux_scenario', targetId: id });
    const [scenario] = await getDb().select().from(uxScenarios).where(eq(uxScenarios.id, id)).limit(1);
    return c.json({ scenario }, 201);
  });

  r.get('/scenarios/:scenarioId/workspace', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    return c.json({ workspace: await readWorkspace(c.req.param('pid')!, c.req.param('scenarioId')!) });
  });

  r.patch('/scenarios/:scenarioId', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const scenarioId = c.req.param('scenarioId')!;
    await scenarioInProject(pid, scenarioId);
    const data = parse(updateScenarioSchema, await c.req.json().catch(() => null));
    const { expectedRevision, ...fields } = data;
    // status='reviewed' は 「人間がレビューした」 と主張する唯一の遷移なので、
    // 他のレビュー操作 (analysis / decision / evidence) と同じ REVIEW_ROLES に揃える。
    // 本文の編集自体は EDIT_ROLES のままで、 status 欄だけを追加で絞る。
    if (fields.status !== undefined && !REVIEW_ROLES.includes(c.get('projectRole'))) {
      throw AppError.forbidden('ux_scenario_status_requires_review_role');
    }
    const [updated] = await getDb().update(uxScenarios).set({
      ...fields,
      revision: expectedRevision + 1,
      updatedAt: new Date(),
    }).where(and(eq(uxScenarios.id, scenarioId), eq(uxScenarios.revision, expectedRevision))).returning();
    if (!updated) throw AppError.conflict('ux_scenario_revision_conflict');
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'ux_scenario.update', targetKind: 'ux_scenario', targetId: scenarioId, meta: { revision: updated.revision } });
    return c.json({ scenario: updated });
  });

  r.post('/scenarios/:scenarioId/use-cases', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const scenarioId = c.req.param('scenarioId')!;
    await scenarioInProject(pid, scenarioId);
    const data = parse(createUseCaseSchema, await c.req.json().catch(() => null));
    const id = ulid();
    const [created] = await getDb().insert(uxUseCases).values({ id, scenarioId, ...data }).returning();
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'ux_use_case.create', targetKind: 'ux_use_case', targetId: id });
    return c.json({ use_case: created }, 201);
  });

  r.patch('/scenarios/:scenarioId/use-cases/:useCaseId', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const scenarioId = c.req.param('scenarioId')!;
    const useCaseId = c.req.param('useCaseId')!;
    await scenarioInProject(pid, scenarioId);
    const data = parse(updateUseCaseSchema, await c.req.json().catch(() => null));
    const { expectedRevision, ...fields } = data;
    const [updated] = await getDb().update(uxUseCases).set({
      ...fields,
      revision: expectedRevision + 1,
      updatedAt: new Date(),
    }).where(and(eq(uxUseCases.id, useCaseId), eq(uxUseCases.scenarioId, scenarioId), eq(uxUseCases.revision, expectedRevision))).returning();
    if (!updated) throw AppError.conflict('ux_use_case_revision_conflict');
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'ux_use_case.update', targetKind: 'ux_use_case', targetId: useCaseId, meta: { revision: updated.revision } });
    return c.json({ useCase: updated });
  });

  r.put('/scenarios/:scenarioId/canvas', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const scenarioId = c.req.param('scenarioId')!;
    await scenarioInProject(pid, scenarioId);
    const data = parse(canvasSchema, await c.req.json().catch(() => null));
    const [updated] = await getDb().update(uxCanvases).set({
      frames: data.frames as CanvasFrame[],
      elements: data.elements as CanvasElement[],
      transitions: data.transitions as CanvasTransition[],
      revision: data.expected_revision + 1,
      updatedBy: getIdentity(c).userId,
      updatedAt: new Date(),
    }).where(and(eq(uxCanvases.scenarioId, scenarioId), eq(uxCanvases.revision, data.expected_revision))).returning();
    if (!updated) throw AppError.conflict('ux_canvas_revision_conflict');
    return c.json({ canvas: updated });
  });

  r.post('/scenarios/:scenarioId/analysis', requireAuth, requireRole(REVIEW_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const scenarioId = c.req.param('scenarioId')!;
    const scenario = await scenarioInProject(pid, scenarioId);
    const data = parse(analysisSchema, await c.req.json().catch(() => null));
    if (scenario.revision !== data.expected_revision) throw AppError.conflict('ux_scenario_revision_conflict');
    const allUseCases = await getDb().select().from(uxUseCases).where(eq(uxUseCases.scenarioId, scenarioId));
    const wanted = data.use_case_ids ? new Set(data.use_case_ids) : null;
    const useCases = wanted ? allUseCases.filter((item) => wanted.has(item.id)) : allUseCases;
    if (useCases.length === 0 || (wanted && useCases.length !== wanted.size)) throw AppError.badRequest('unknown_or_empty_use_case_selection');
    const [project] = await getDb().select().from(projects).where(eq(projects.id, pid)).limit(1);
    if (!project?.anatomiaRepo) throw new AppError('anatomia_repo_unset', 409);
    const identity = getIdentity(c);
    const analysisId = ulid();
    await getDb().insert(uxAnalysisRuns).values({
      id: analysisId,
      scenarioId,
      scenarioRevision: scenario.revision,
      useCaseIds: useCases.map((item) => item.id),
      useCaseRevisions: Object.fromEntries(useCases.map((item) => [item.id, item.revision])),
      note: data.note ?? null,
      visibility: data.visibility,
      status: 'running',
      requestedBy: identity.userId,
    });
    try {
      const anatomia = await fetchDomainOrganization(options.anatomia, project.anatomiaRepo);
      const llm = await analyzeUxBoundaries(options.claudeBin, {
        scenario,
        useCases,
        anatomiaDomains: anatomia.domains,
        note: data.note ?? null,
      });
      const useCaseIds = new Set(useCases.map((item) => item.id));
      const anatomiaIds = new Set(anatomia.domains.map((domain) => domain.id));
      const candidateNames = new Set(llm.candidates.map((candidate) => candidate.name));
      if (candidateNames.size !== llm.candidates.length
        || llm.candidates.some((candidate) => candidate.use_case_ids.some((id) => !useCaseIds.has(id))
          || candidate.existing_domain_refs.some((id) => !anatomiaIds.has(id)))) {
        throw new AppError('llm_boundary_reference_mismatch', 502);
      }
      const queryText = geniusQueryText({
        scenarioName: scenario.name,
        useCaseTitles: useCases.map((item) => item.title),
        candidates: llm.candidates,
      });
      // Genius はオプトイン。 未設定なら過去判断の再利用を飛ばして解析を続ける。
      // カードが 0 件のときは assessCandidatesWithGenius が「再利用できる判断が無いので
      // 人間が採否理由を記録する」 という human_question を立てるので、 設計フロー自体は
      // 成立する。 補助が無いだけで作業を止めない。
      const genius = isGeniusEnabled(options.genius)
        ? await queryGenius(options.genius, { text: queryText, visibility: data.visibility })
        : { cards: [], raw: { enabled: false } };
      const assessments = await assessCandidatesWithGenius(options.claudeBin, {
        candidates: llm.candidates,
        cards: genius.cards,
      });
      const currentScenario = await scenarioInProject(pid, scenarioId);
      const currentUseCases = await getDb().select().from(uxUseCases).where(eq(uxUseCases.scenarioId, scenarioId));
      const currentRevisions = new Map(currentUseCases.map((item) => [item.id, item.revision]));
      if (currentScenario.revision !== scenario.revision
        || useCases.some((item) => currentRevisions.get(item.id) !== item.revision)) {
        throw AppError.conflict('ux_analysis_stale');
      }
      const assessmentByName = new Map(assessments.map((item) => [item.proposal_name, item]));
      const values = llm.candidates.map((candidate) => {
        const assessment = assessmentByName.get(candidate.name);
        return {
          id: ulid(),
          analysisId,
          scenarioId,
          useCaseIds: candidate.use_case_ids,
          name: candidate.name,
          purpose: candidate.purpose,
          classification: candidate.classification,
          responsibilities: candidate.responsibilities,
          businessRules: candidate.business_rules,
          inScope: candidate.in_scope,
          outOfScope: candidate.out_of_scope,
          collaborations: candidate.collaborations,
          assumptions: candidate.assumptions,
          unresolvedQuestions: candidate.unresolved_questions,
          alternatives: candidate.alternatives,
          confidence: Math.round(candidate.confidence * 100),
          rationale: candidate.rationale,
          existingDomainRefs: candidate.existing_domain_refs,
          geniusAssessments: assessment?.card_applications ?? [],
          humanQuestions: assessment?.human_questions ?? [],
        };
      });
      await completeBoundaryAnalysis({
        analysisId,
        anatomiaSourceRevision: anatomia.knowledgeHead,
        geniusQuery: { text: queryText, cards: genius.cards },
        proposals: values,
      });
      await recordAudit({ projectId: pid, actor: identity, action: 'ux_boundary.analysis', targetKind: 'ux_analysis', targetId: analysisId, meta: { proposal_count: values.length } });
      const [analysis] = await getDb().select().from(uxAnalysisRuns).where(eq(uxAnalysisRuns.id, analysisId)).limit(1);
      const proposals = await getDb().select().from(uxBoundaryProposals).where(eq(uxBoundaryProposals.analysisId, analysisId));
      return c.json({ analysis, proposals }, 201);
    } catch (error) {
      await recordRunFailure(
        getDb().update(uxAnalysisRuns).set({ status: 'error', errorCode: errorCode(error), completedAt: new Date() })
          .where(eq(uxAnalysisRuns.id, analysisId)),
        analysisId,
      );
      if (error instanceof AppError) throw error;
      throw new AppError('ux_analysis_failed', 502, { reason: String(error) });
    }
  });

  r.post('/scenarios/:scenarioId/proposals/:proposalId/decisions', requireAuth, requireRole(REVIEW_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const scenarioId = c.req.param('scenarioId')!;
    const proposalId = c.req.param('proposalId')!;
    const scenario = await scenarioInProject(pid, scenarioId);
    const data = parse(decisionSchema, await c.req.json().catch(() => null));
    const [proposal] = await getDb().select().from(uxBoundaryProposals)
      .where(and(eq(uxBoundaryProposals.id, proposalId), eq(uxBoundaryProposals.scenarioId, scenarioId))).limit(1);
    if (!proposal) throw AppError.notFound('ux_boundary_proposal_not_found');
    if (proposal.revision !== data.expected_proposal_revision) throw AppError.conflict('ux_boundary_proposal_revision_conflict');
    const [proposalAnalysis] = await getDb().select().from(uxAnalysisRuns)
      .where(eq(uxAnalysisRuns.id, proposal.analysisId)).limit(1);
    if (!proposalAnalysis || proposalAnalysis.scenarioRevision !== scenario.revision) throw AppError.conflict('ux_analysis_stale');
    const decisionUseCases = await getDb().select().from(uxUseCases).where(eq(uxUseCases.scenarioId, scenarioId));
    const decisionRevisions = new Map(decisionUseCases.map((item) => [item.id, item.revision]));
    if (Object.entries(proposalAnalysis.useCaseRevisions)
      .some(([id, revision]) => decisionRevisions.get(id) !== revision)) throw AppError.conflict('ux_analysis_stale');
    const boundaries = asBoundarySnapshots(data, proposal);
    // Genius への送出はオプトイン。 判断そのものは Genius の有無に関わらず確定する。
    const geniusEnabled = isGeniusEnabled(options.genius);
    const allowedUseCases = new Set(proposalAnalysis.useCaseIds);
    if (new Set(boundaries.map((boundary) => boundary.name)).size !== boundaries.length
      || boundaries.some((boundary) => boundary.use_case_ids.some((id) => !allowedUseCases.has(id)))) {
      throw AppError.badRequest('decision_boundary_reference_mismatch');
    }
    const nextStatus = data.action === 'reject'
      ? 'rejected'
      : boundaries.some((boundary) => boundary.classification === 'core') ? 'accepted' : 'externalized';
    const identity = getIdentity(c);
    const decisionId = ulid();
    try {
      await getDb().insert(uxBoundaryDecisions).values({
        id: decisionId,
        scenarioId,
        proposalId,
        action: data.action,
        proposalRevision: proposal.revision,
        rationale: data.rationale,
        resultBoundaries: boundaries,
        decidedBy: identity.userId,
        // 送出しないと決まっているなら publishing を経由しない。 経由すると、 一度も
        // 送らなかった判断が failed か publishing で残り、 「送って落ちた」 と区別できない。
        geniusPublishStatus: geniusEnabled ? 'publishing' : 'not_requested',
      });
    } catch (error) {
      if (isUniqueConflict(error)) throw AppError.conflict('ux_boundary_already_decided');
      throw error;
    }
    const analysis = proposalAnalysis;
    if (geniusEnabled) {
      try {
        const published = await publishGeniusDecision(options.genius, {
          visibility: analysis?.visibility === 'public' ? 'public' : 'sensitive',
          situation: `Praeforma UXシナリオ「${scenario.name}」の境界候補「${proposal.name}」`,
          judgment: JSON.stringify({ action: data.action, boundaries }),
          rationale: data.rationale,
          sourceRef: `praeforma://${pid}/ux-scenarios/${scenarioId}/decisions/${decisionId}`,
        });
        await getDb().update(uxBoundaryDecisions).set({ geniusPublishStatus: 'published', geniusCardId: published.id })
          .where(eq(uxBoundaryDecisions.id, decisionId));
      } catch (error) {
        // 判断そのものは確定済み。 Genius 送出の失敗で 201 を取り消さず failed として残す。
        // 状態書き込みまで失敗した場合は publishing のまま残るので log で追えるようにする。
        try {
          await getDb().update(uxBoundaryDecisions).set({
            geniusPublishStatus: 'failed',
            geniusError: errorCode(error),
          }).where(eq(uxBoundaryDecisions.id, decisionId));
        } catch (e) {
          console.error(`[ux-design] failed to mark decision ${decisionId} genius publish as failed: ${String(e)}`);
        }
      }
    }
    await recordAudit({ projectId: pid, actor: identity, action: 'ux_boundary.decide', targetKind: 'ux_boundary_proposal', targetId: proposalId, meta: { action: data.action, status: nextStatus } });
    const [decision] = await getDb().select().from(uxBoundaryDecisions).where(eq(uxBoundaryDecisions.id, decisionId)).limit(1);
    return c.json({ decision, proposal: { ...proposal, status: nextStatus } }, 201);
  });

  r.post('/scenarios/:scenarioId/evidence', requireAuth, requireRole(REVIEW_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const scenarioId = c.req.param('scenarioId')!;
    const scenario = await scenarioInProject(pid, scenarioId);
    const data = parse(evidenceSchema, await c.req.json().catch(() => null));
    if (scenario.revision !== data.expectedScenarioRevision) throw AppError.conflict('ux_scenario_revision_conflict');
    let useCaseRevision: number | null = null;
    if (data.targetKind === 'scenario' && data.targetId !== scenarioId) throw AppError.badRequest('evidence_target_mismatch');
    if (data.targetKind === 'use_case') {
      const [useCase] = await getDb().select().from(uxUseCases)
        .where(and(eq(uxUseCases.id, data.targetId), eq(uxUseCases.scenarioId, scenarioId))).limit(1);
      if (!useCase) throw AppError.badRequest('evidence_target_mismatch');
      if (data.expectedUseCaseRevision !== useCase.revision) throw AppError.conflict('ux_use_case_revision_conflict');
      useCaseRevision = useCase.revision;
    }
    if (data.targetKind === 'proposal') {
      const [proposal] = await getDb().select().from(uxBoundaryProposals)
        .where(and(eq(uxBoundaryProposals.id, data.targetId), eq(uxBoundaryProposals.scenarioId, scenarioId))).limit(1);
      if (!proposal) throw AppError.badRequest('evidence_target_mismatch');
    }
    let canvasRevision: number | null = null;
    if (data.expectedCanvasRevision !== null && data.expectedCanvasRevision !== undefined) {
      const canvas = await currentCanvas(scenarioId);
      if (canvas.revision !== data.expectedCanvasRevision) throw AppError.conflict('ux_canvas_revision_conflict');
      canvasRevision = canvas.revision;
    }
    const id = ulid();
    let created: typeof uxEvidence.$inferSelect;
    try {
      const rows = await getDb().insert(uxEvidence).values({
        id,
        scenarioId,
        targetKind: data.targetKind,
        targetId: data.targetId,
        kind: data.kind,
        sourceProjectKey: data.sourceProjectKey,
        sourceRevision: data.sourceRevision,
        sourceRef: data.sourceRef,
        status: data.status,
        scenarioRevision: scenario.revision,
        useCaseRevision,
        canvasRevision,
        payload: data.payload,
        recordedBy: getIdentity(c).userId,
      }).returning();
      if (!rows[0]) throw AppError.internal('ux_evidence_insert_failed');
      created = rows[0];
    } catch (error) {
      if (isUniqueConflict(error)) throw AppError.conflict('ux_evidence_already_recorded');
      throw error;
    }
    return c.json({ evidence: { ...created, isStale: false } }, 201);
  });

  r.post('/scenarios/:scenarioId/proposals/:proposalId/anatomia-evidence', requireAuth, requireRole(REVIEW_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const scenarioId = c.req.param('scenarioId')!;
    const proposalId = c.req.param('proposalId')!;
    const scenario = await scenarioInProject(pid, scenarioId);
    const body = parse(anatomiaEvidenceSchema, await c.req.json().catch(() => null));
    const [proposal] = await getDb().select().from(uxBoundaryProposals)
      .where(and(eq(uxBoundaryProposals.id, proposalId), eq(uxBoundaryProposals.scenarioId, scenarioId))).limit(1);
    if (!proposal) throw AppError.notFound('ux_boundary_proposal_not_found');
    if (proposal.revision !== body.expectedProposalRevision) throw AppError.conflict('ux_boundary_proposal_revision_conflict');
    const [project] = await getDb().select().from(projects).where(eq(projects.id, pid)).limit(1);
    if (!project?.anatomiaRepo) throw new AppError('anatomia_repo_unset', 409);
    const graph = await fetchStudioGraph(options.anatomia, project.anatomiaRepo, { kind: 'domain', name: proposal.name }, body.query);
    const organization = await fetchDomainOrganization(options.anatomia, project.anatomiaRepo);
    const graphRevision = `graph-snapshot:sha256:${createHash('sha256').update(JSON.stringify(graph), 'utf8').digest('hex')}`;
    const id = ulid();
    let created: typeof uxEvidence.$inferSelect;
    try {
      const rows = await getDb().insert(uxEvidence).values({
        id,
        scenarioId,
        targetKind: 'proposal',
        targetId: proposalId,
        kind: 'anatomia',
        sourceProjectKey: project.anatomiaRepo,
        sourceRevision: graphRevision,
        sourceRef: `anatomia://${project.anatomiaRepo}/domain/${encodeURIComponent(proposal.name)}`,
        status: graph.nodes.length > 0 ? 'candidate' : 'missing',
        scenarioRevision: scenario.revision,
        canvasRevision: null,
        useCaseRevision: null,
        payload: { graph, knowledgeHead: organization.knowledgeHead, sourceFreshness: 'captured' },
        recordedBy: getIdentity(c).userId,
      }).returning();
      if (!rows[0]) throw AppError.internal('ux_evidence_insert_failed');
      created = rows[0];
    } catch (error) {
      if (isUniqueConflict(error)) throw AppError.conflict('ux_evidence_already_recorded');
      throw error;
    }
    return c.json({ evidence: { ...created, isStale: false } }, 201);
  });

  r.post(
    '/scenarios/:scenarioId/canvas/image-analysis',
    bodyLimit({ maxSize: MAX_IMAGE_REQUEST_BYTES, onError: (c) => c.json({ error: 'image_request_too_large' }, 413) }),
    requireAuth,
    requireRole(EDIT_ROLES),
    async (c) => {
    // request 全体のサイズは bodyLimit middleware が既に拒否している。
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const scenarioId = c.req.param('scenarioId')!;
    await scenarioInProject(pid, scenarioId);
    const form = await c.req.parseBody();
    const expected = Number(form.expected_canvas_revision);
    if (!Number.isInteger(expected) || expected < 0) throw AppError.badRequest('expected_canvas_revision_required');
    const canvas = await currentCanvas(scenarioId);
    if (canvas.revision !== expected) throw AppError.conflict('ux_canvas_revision_conflict');
    const file = form.image;
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') throw AppError.badRequest('image_required');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new AppError('image_request_too_large', 413);
    const identity = getIdentity(c);
    const analysisId = ulid();
    await getDb().insert(uxImageAnalyses).values({
      id: analysisId,
      scenarioId,
      baseCanvasRevision: canvas.revision,
      imageFingerprint: 'pending',
      status: 'running',
      requestedBy: identity.userId,
    });
    try {
      const result = await analyzeLayoutImage(options.claudeBin, bytes, file.type);
      await getDb().update(uxImageAnalyses).set({
        imageFingerprint: result.fingerprint,
        status: 'completed',
        candidates: result.candidates,
        completedAt: new Date(),
      }).where(eq(uxImageAnalyses.id, analysisId));
      const [analysis] = await getDb().select().from(uxImageAnalyses).where(eq(uxImageAnalyses.id, analysisId)).limit(1);
      return c.json({ analysis, candidates: result.candidates }, 201);
    } catch (error) {
      await recordRunFailure(
        getDb().update(uxImageAnalyses).set({ status: 'error', errorCode: errorCode(error), completedAt: new Date() })
          .where(eq(uxImageAnalyses.id, analysisId)),
        analysisId,
      );
      if (error instanceof AppError) throw error;
      throw new AppError('image_analysis_failed', 502, { reason: String(error) });
    }
    },
  );

  r.post('/scenarios/:scenarioId/canvas/image-analysis/:analysisId/apply', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const scenarioId = c.req.param('scenarioId')!;
    await scenarioInProject(pid, scenarioId);
    const data = parse(imageApplySchema, await c.req.json().catch(() => null));
    const [analysis] = await getDb().select().from(uxImageAnalyses).where(and(
      eq(uxImageAnalyses.id, c.req.param('analysisId')!),
      eq(uxImageAnalyses.scenarioId, scenarioId),
    )).limit(1);
    if (!analysis || analysis.status !== 'completed') throw AppError.notFound('ux_image_analysis_not_ready');
    const candidates = analysis.candidates as unknown as ImageLayoutCandidate[];
    const selectedIds = new Set(data.candidate_ids);
    if (selectedIds.size !== data.candidate_ids.length) throw AppError.badRequest('duplicate_image_candidate');
    const selected = candidates.filter((candidate) => selectedIds.has(candidate.id));
    if (selected.length !== selectedIds.size) throw AppError.badRequest('unknown_image_candidate');
    const canvas = await currentCanvas(scenarioId);
    if (canvas.revision !== data.expected_canvas_revision) throw AppError.conflict('ux_canvas_revision_conflict');
    if (canvas.revision !== analysis.baseCanvasRevision) throw AppError.conflict('ux_image_analysis_stale');
    if (canvas.appliedImageAnalysisIds.includes(analysis.id)) throw AppError.conflict('ux_image_analysis_already_applied');
    const frames = [...canvas.frames];
    const elements = [...canvas.elements];
    for (const [candidateIndex, candidate] of selected.entries()) {
      const frameId = `image-${analysis.id}-${candidateIndex}`;
      const elementIds = new Map(candidate.elements.map((element) => [element.id, ulid()]));
      frames.push({ ...candidate.frame, id: frameId });
      elements.push(...candidate.elements.map((element) => ({
        ...element,
        id: elementIds.get(element.id)!,
        frame_id: frameId,
        follow: element.follow ? (() => {
          const target = elementIds.get(element.follow.target_element_id);
          if (!target) throw new AppError('image_candidate_reference_invalid', 502);
          return { ...element.follow, target_element_id: target };
        })() : null,
      })));
    }
    const merged = parse(canvasSchema, {
      expected_revision: canvas.revision,
      frames,
      elements,
      transitions: canvas.transitions,
    });
    const [updated] = await getDb().update(uxCanvases).set({
      frames: merged.frames,
      elements: merged.elements,
      appliedImageAnalysisIds: [...canvas.appliedImageAnalysisIds, analysis.id],
      revision: canvas.revision + 1,
      updatedBy: getIdentity(c).userId,
      updatedAt: new Date(),
    }).where(and(eq(uxCanvases.scenarioId, scenarioId), eq(uxCanvases.revision, canvas.revision))).returning();
    if (!updated) throw AppError.conflict('ux_canvas_revision_conflict');
    return c.json({ canvas: updated });
  });

  return r;
}
