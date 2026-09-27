import { createHash } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { projects } from '../db/schema/project.ts';
import { specs, specTargets, specAcceptance } from '../db/schema/spec.ts';
import { sceneDocuments } from '../db/schema/scene-editor.ts';
import { layouts } from '../db/schema/layout.ts';
import { uxScenarios, uxCanvases, uxUseCases } from '../db/schema/ux-design.ts';
import { seedScene } from './scene-seed.ts';
import { AppError } from './errors.ts';

export interface ImplementationManifest {
  projectId: string; teamId: string;
  subjects: { kind: 'spec' | 'scenario'; id: string; title: string; revision: string; description: string }[];
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}
export function specificationFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

/** This endpoint never calls Actio: Actio owns status and reads the specification from Pf. */
export async function implementationManifest(projectId: string): Promise<ImplementationManifest> {
  const db = getDb();
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), isNull(projects.deletedAt))).limit(1);
  if (!project) throw AppError.notFound();
  const [rows, targets, acceptance, scenes, sceneLayouts, scenarioRows] = await Promise.all([
    db.select().from(specs).where(and(eq(specs.projectId, projectId), isNull(specs.deletedAt))).orderBy(asc(specs.id)),
    db.select({ target: specTargets }).from(specTargets).innerJoin(specs, eq(specs.id, specTargets.specId)).where(eq(specs.projectId, projectId)).orderBy(asc(specTargets.specId), asc(specTargets.kind), asc(specTargets.refId)),
    db.select({ item: specAcceptance }).from(specAcceptance).innerJoin(specs, eq(specs.id, specAcceptance.specId)).where(eq(specs.projectId, projectId)).orderBy(asc(specAcceptance.specId), asc(specAcceptance.ordinal), asc(specAcceptance.id)),
    db.select().from(sceneDocuments).where(eq(sceneDocuments.projectId, projectId)).orderBy(asc(sceneDocuments.layoutId)),
    db.select().from(layouts).where(eq(layouts.projectId, projectId)).orderBy(asc(layouts.id)),
    db.select().from(uxScenarios).where(eq(uxScenarios.projectId, projectId)).orderBy(asc(uxScenarios.id)),
  ]);
  const sceneMaterials = await Promise.all(sceneLayouts.filter(layout => !layout.deletedAt).map(async layout => ({
    layout, document: scenes.find(scene => scene.layoutId === layout.id) ?? await seedScene(projectId, layout.id, layout.name),
  })));
  const materials = rows.map(spec => ({ spec, targets: targets.filter(row => row.target.specId === spec.id).map(row => row.target), acceptance: acceptance.filter(row => row.item.specId === spec.id).map(row => row.item) }));
  const subjects: ImplementationManifest['subjects'] = materials.filter(row => row.spec.status !== 'obsolete').map(row => ({ kind: 'spec', id: row.spec.id,
    title: `${row.spec.code} ${row.spec.title}`, revision: specificationFingerprint({ ...row, scenes: sceneMaterials.filter(scene => !row.targets.length || row.targets.some(target => target.kind === 'layout' && target.refId === scene.layout.id)) }), description: row.spec.description ?? '' }));
  for (const scenario of scenarioRows) {
    const [canvases, useCases] = await Promise.all([
      db.select().from(uxCanvases).where(eq(uxCanvases.scenarioId, scenario.id)).limit(1),
      db.select().from(uxUseCases).where(eq(uxUseCases.scenarioId, scenario.id)).orderBy(asc(uxUseCases.ordinal), asc(uxUseCases.id)),
    ]);
    const canvas = canvases[0];
    if (!canvas) throw AppError.notFound('ux_canvas_not_found');
    const workspace = { scenario, useCases, canvas };
    const linkedLayouts = new Set(canvas.frames.map(frame => frame.scene_ref?.layout_id).filter(Boolean));
    // Until scenario-to-spec targets exist, all project specifications are dependencies; changes conservatively request re-review.
    subjects.push({ kind: 'scenario', id: scenario.id, title: scenario.name,
      revision: specificationFingerprint({ workspace, specifications: materials, scenes: sceneMaterials.filter(row => linkedLayouts.has(row.layout.id)), layouts: sceneLayouts.filter(row => linkedLayouts.has(row.id)) }),
      description: [scenario.experience, scenario.goal, scenario.visualDirection, scenario.successOutcome].filter(Boolean).join('\n') });
  }
  return { projectId, teamId: project.orgId, subjects };
}
