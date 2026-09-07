import { and, eq } from 'drizzle-orm';
import { getDb, getLocalSqlite } from './connection.ts';
import { AppError } from '../lib/errors.ts';
import {
  uxAnalysisRuns,
  uxBoundaryProposals,
  uxCanvases,
  uxScenarios,
} from './schema/ux-design.ts';

type ScenarioInsert = typeof uxScenarios.$inferInsert;
type CanvasInsert = typeof uxCanvases.$inferInsert;
type ProposalInsert = typeof uxBoundaryProposals.$inferInsert;

/** Creates the scenario and its empty canvas as one unit in either database dialect. */
export async function createScenarioWithCanvas(
  scenario: ScenarioInsert,
  canvas: CanvasInsert,
): Promise<void> {
  const sqlite = getLocalSqlite();
  if (sqlite) {
    const now = Date.now();
    sqlite.transaction(() => {
      sqlite.prepare(`INSERT INTO ux_scenarios
        (id, project_id, name, actor, context, goal, success_outcome, source_project_key,
         source_refs, status, revision, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?)`)
        .run(
          scenario.id,
          scenario.projectId,
          scenario.name,
          scenario.actor,
          scenario.context ?? '',
          scenario.goal,
          scenario.successOutcome,
          scenario.sourceProjectKey ?? null,
          JSON.stringify(scenario.sourceRefs ?? []),
          scenario.createdBy,
          now,
          now,
        );
      sqlite.prepare(`INSERT INTO ux_canvases
        (scenario_id, revision, frames, elements, transitions, applied_image_analysis_ids, updated_by, updated_at)
        VALUES (?, 1, '[]', '[]', '[]', '[]', ?, ?)`)
        .run(canvas.scenarioId, canvas.updatedBy, now);
    })();
    return;
  }
  await getDb().transaction(async (tx) => {
    await tx.insert(uxScenarios).values(scenario);
    await tx.insert(uxCanvases).values(canvas);
  });
}

/** Persists all proposals and marks their run complete without exposing a partial result. */
export async function completeBoundaryAnalysis(input: {
  analysisId: string;
  anatomiaSourceRevision: string | null;
  geniusQuery: Record<string, unknown>;
  proposals: ProposalInsert[];
}): Promise<void> {
  const completedAt = new Date();
  const sqlite = getLocalSqlite();
  if (sqlite) {
    const now = completedAt.getTime();
    sqlite.transaction(() => {
      const statement = sqlite.prepare(`INSERT INTO ux_boundary_proposals
        (id, analysis_id, scenario_id, use_case_ids, name, purpose, classification,
         responsibilities, business_rules, in_scope, out_of_scope, collaborations,
         assumptions, unresolved_questions, alternatives, confidence, rationale,
         existing_domain_refs, genius_assessments, human_questions, status, revision,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)`);
      for (const proposal of input.proposals) {
        statement.run(
          proposal.id,
          proposal.analysisId,
          proposal.scenarioId,
          JSON.stringify(proposal.useCaseIds ?? []),
          proposal.name,
          proposal.purpose,
          proposal.classification,
          JSON.stringify(proposal.responsibilities ?? []),
          JSON.stringify(proposal.businessRules ?? []),
          JSON.stringify(proposal.inScope ?? []),
          JSON.stringify(proposal.outOfScope ?? []),
          JSON.stringify(proposal.collaborations ?? []),
          JSON.stringify(proposal.assumptions ?? []),
          JSON.stringify(proposal.unresolvedQuestions ?? []),
          JSON.stringify(proposal.alternatives ?? []),
          proposal.confidence,
          proposal.rationale,
          JSON.stringify(proposal.existingDomainRefs ?? []),
          JSON.stringify(proposal.geniusAssessments ?? []),
          JSON.stringify(proposal.humanQuestions ?? []),
          now,
          now,
        );
      }
      const result = sqlite.prepare(`UPDATE ux_analysis_runs
        SET status = 'completed', anatomia_source_revision = ?, genius_query = ?, completed_at = ?
        WHERE id = ? AND status = 'running'`)
        .run(input.anatomiaSourceRevision, JSON.stringify(input.geniusQuery), now, input.analysisId);
      // run が既に error 等へ遷移していたら候補だけ残さない (= transaction ごと巻き戻す)。
      if (result.changes !== 1) throw new AppError('ux_analysis_stale', 409);
    })();
    return;
  }
  await getDb().transaction(async (tx) => {
    await tx.insert(uxBoundaryProposals).values(input.proposals);
    // SQLite 側と同じく running からの遷移だけを完了として扱う。
    const updated = await tx.update(uxAnalysisRuns).set({
      status: 'completed',
      anatomiaSourceRevision: input.anatomiaSourceRevision,
      geniusQuery: input.geniusQuery,
      completedAt,
    }).where(and(eq(uxAnalysisRuns.id, input.analysisId), eq(uxAnalysisRuns.status, 'running'))).returning();
    if (updated.length !== 1) throw new AppError('ux_analysis_stale', 409);
  });
}
