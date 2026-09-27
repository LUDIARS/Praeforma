import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { projects } from '../db/schema/project.ts';
import { layouts } from '../db/schema/layout.ts';
import { specs, specTargets } from '../db/schema/spec.ts';
import { uxCanvases, uxScenarios } from '../db/schema/ux-design.ts';
import { sceneDocuments } from '../db/schema/scene-editor.ts';
import { readWorkspace } from './ux-workspace-read.ts';
import { readAcceptanceRuns, readAcceptanceResultStatuses, readSpecVersionHead } from '../db/acceptance-summary-reads.ts';
import { pickLatestRun, summarizeAcceptance } from './acceptance-summary.ts';
import { seedScene } from './scene-seed.ts';
import { AppError } from './errors.ts';
import type { ReviewOverlaySnapshot } from '../../../shared/review-overlay.ts';

/** Read-only projection. A scene filters explicit layout targets; untargeted specs apply project-wide. */
export async function readReviewOverlay(projectId: string, layoutId?: string): Promise<ReviewOverlaySnapshot> {
  const db = getDb();
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), isNull(projects.deletedAt))).limit(1);
  if (!project) throw AppError.notFound('project_not_found');
  let scene: ReviewOverlaySnapshot['scene'] = null;
  if (layoutId) {
    const [layout] = await db.select().from(layouts).where(and(eq(layouts.id, layoutId), eq(layouts.projectId, projectId), isNull(layouts.deletedAt))).limit(1);
    if (!layout) throw AppError.notFound('scene_not_found');
    const [row] = await db.select().from(sceneDocuments).where(and(eq(sceneDocuments.projectId, projectId), eq(sceneDocuments.layoutId, layoutId))).limit(1);
    const document = row ? row.payload : await seedScene(projectId, layoutId, layout.name);
    scene = { id: layoutId, name: layout.name, canvas: { ...document.canvas, revision: row?.revision ?? document.canvas.revision } };
  }
  const [specRows, targets, scenarioRows, runs, specVersionHead] = await Promise.all([
    db.select().from(specs).where(and(eq(specs.projectId, projectId), isNull(specs.deletedAt))).orderBy(asc(specs.code)),
    db.select({ specId: specTargets.specId, kind: specTargets.kind, refId: specTargets.refId }).from(specTargets)
      .innerJoin(specs, eq(specs.id, specTargets.specId)).where(eq(specs.projectId, projectId)),
    db.select({ scenario: uxScenarios, canvas: uxCanvases }).from(uxScenarios)
      .innerJoin(uxCanvases, eq(uxCanvases.scenarioId, uxScenarios.id)).where(eq(uxScenarios.projectId, projectId)).orderBy(asc(uxScenarios.name)),
    readAcceptanceRuns(projectId), readSpecVersionHead(projectId),
  ]);
  const latest = pickLatestRun(runs);
  const latestResults = latest ? await readAcceptanceResultStatuses(latest.id) : [];
  const matching = scenarioRows.filter(row => !layoutId || row.canvas.frames.some(frame => frame.scene_ref?.layout_id === layoutId));
  const scenarios: ReviewOverlaySnapshot['scenarios'] = [];
  for (const row of matching) {
    const workspace = await readWorkspace(projectId, row.scenario.id);
    const scenario = workspace.scenario;
    const evidence = workspace.evidence.map(item => ({ targetKind: item.targetKind, targetId: item.targetId,
      kind: item.kind, status: item.status, sourceRef: item.sourceRef, sourceRevision: item.sourceRevision, isStale: item.isStale }));
    scenarios.push({ id: scenario.id, name: scenario.name, category: scenario.category, experience: scenario.experience,
      visualDirection: scenario.visualDirection, goal: scenario.goal, successOutcome: scenario.successOutcome, revision: scenario.revision,
      canvas: workspace.canvas, evidence });
  }
  return { projectId, teamId: project.orgId, projectName: project.name, scene, scenarios,
    implementation: { state: 'unavailable', message: 'Actio の実装状況を未取得です。', items: [] },
    specs: specRows.filter(spec => {
      if (!layoutId) return true;
      const refs = targets.filter(target => target.specId === spec.id);
      return !refs.length || refs.some(target => target.kind === 'layout' && target.refId === layoutId);
    }).map(({ id, code, title, description, status, version }) => ({ id, code, title, description, status, version })),
    acceptance: summarizeAcceptance({ projectId, runs, latestResults, specVersionHead }),
  };
}
