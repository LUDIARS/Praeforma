import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import {
  uxAnalysisRuns,
  uxBoundaryDecisions,
  uxBoundaryProposals,
  uxCanvases,
  uxEvidence,
  uxScenarios,
  uxUseCases,
  type BoundarySnapshot,
} from '../db/schema/ux-design.ts';
import { AppError } from '../lib/errors.ts';

export async function scenarioInProject(pid: string, scenarioId: string) {
  const [scenario] = await getDb().select().from(uxScenarios)
    .where(and(eq(uxScenarios.id, scenarioId), eq(uxScenarios.projectId, pid))).limit(1);
  if (!scenario) throw AppError.notFound('ux_scenario_not_found');
  return scenario;
}

export async function currentCanvas(scenarioId: string) {
  const [canvas] = await getDb().select().from(uxCanvases).where(eq(uxCanvases.scenarioId, scenarioId)).limit(1);
  if (!canvas) throw AppError.notFound('ux_canvas_not_found');
  return canvas;
}

export async function readWorkspace(pid: string, scenarioId: string) {
  const scenario = await scenarioInProject(pid, scenarioId);
  const [useCases, canvas, analyses, proposals, decisions, evidence] = await Promise.all([
    getDb().select().from(uxUseCases).where(eq(uxUseCases.scenarioId, scenarioId)).orderBy(asc(uxUseCases.ordinal)),
    currentCanvas(scenarioId),
    getDb().select().from(uxAnalysisRuns).where(eq(uxAnalysisRuns.scenarioId, scenarioId))
      .orderBy(desc(uxAnalysisRuns.createdAt)),
    getDb().select().from(uxBoundaryProposals).where(eq(uxBoundaryProposals.scenarioId, scenarioId))
      .orderBy(desc(uxBoundaryProposals.createdAt)),
    // ULID は生成時刻順に単調増加するので、 createdAt が同値でも最新判断が先頭に来る。
    // 「最新判断から status を投影する」 仕様上、 ここの順序が accepted / externalized を決める。
    getDb().select().from(uxBoundaryDecisions).where(eq(uxBoundaryDecisions.scenarioId, scenarioId))
      .orderBy(desc(uxBoundaryDecisions.createdAt), desc(uxBoundaryDecisions.id)),
    getDb().select().from(uxEvidence).where(eq(uxEvidence.scenarioId, scenarioId))
      .orderBy(desc(uxEvidence.recordedAt)),
  ]);
  const useCaseRevisions = new Map(useCases.map((item) => [item.id, item.revision]));
  const analysisById = new Map(analyses.map((item) => [item.id, item]));
  const latestAnalysis = analyses[0] ?? null;
  const normalizedLatestAnalysis = latestAnalysis
    ? {
      ...latestAnalysis,
      geniusQuery: Object.keys(latestAnalysis.geniusQuery).length > 0 ? latestAnalysis.geniusQuery : null,
    }
    : null;
  return {
    scenario,
    useCases,
    canvas,
    latestAnalysis: normalizedLatestAnalysis,
    proposals: proposals.map((proposal) => {
      const proposalAnalysis = analysisById.get(proposal.analysisId);
      const isCurrent = proposalAnalysis !== undefined
        && proposalAnalysis.scenarioRevision === scenario.revision
        && Object.entries(proposalAnalysis.useCaseRevisions)
          .every(([id, revision]) => useCaseRevisions.get(id) === revision);
      const latest = decisions.find((decision) => decision.proposalId === proposal.id);
      const result = latest?.resultBoundaries as BoundarySnapshot[] | undefined;
      const status = !latest ? proposal.status : latest.action === 'reject'
        ? 'rejected'
        : result?.some((boundary) => boundary.classification === 'core') ? 'accepted' : 'externalized';
      return { ...proposal, status, isCurrent };
    }),
    decisions,
    evidence: evidence.map((item) => ({
      ...item,
      isStale: item.scenarioRevision !== scenario.revision
        || (item.targetKind === 'use_case' && item.useCaseRevision !== useCaseRevisions.get(item.targetId))
        || (item.canvasRevision !== null && item.canvasRevision !== canvas.revision),
    })),
  };
}
