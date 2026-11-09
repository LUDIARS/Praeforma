/** Builds the files that represent one project on its repository's data branch. */
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../../db/connection.ts';
import { dataDesigns } from '../../db/schema/data-design.ts';
import { domains } from '../../db/schema/domain.ts';
import { layoutObjects, layouts } from '../../db/schema/layout.ts';
import { objectAttrs, objects } from '../../db/schema/object.ts';
import { projects } from '../../db/schema/project.ts';
import { sceneDocuments } from '../../db/schema/scene-editor.ts';
import { transitions } from '../../db/schema/screen-flow.ts';
import { specAcceptance, specTargets, specs } from '../../db/schema/spec.ts';
import { specFragments } from '../../db/schema/spec-fragment.ts';
import { uxBoundaryDecisions, uxBoundaryProposals, uxCanvases, uxEvidence, uxScenarios, uxUseCases } from '../../db/schema/ux-design.ts';
import { fragmentDispositions, PENDING_DISPOSITION } from '../fragment-disposition.ts';
import { DATA_MANIFEST_PATH, type DataFile } from './data-branch-git.ts';
import { stableJson, stableRowsJson } from './stable-json.ts';

const FORMAT = 'praeforma.repo-data/1';

type Project = typeof projects.$inferSelect;

function uxGoalOf(project: Project): Record<string, unknown> {
  return Object.fromEntries(Object.entries(project).filter(([key]) => key.startsWith('ux')));
}

async function fragmentFiles(projectId: string): Promise<DataFile[]> {
  const rows = await getDb().select().from(specFragments).where(eq(specFragments.projectId, projectId));
  const dispositions = await fragmentDispositions(rows.map((row) => row.id));
  const withDisposition = rows.map((row) => ({ ...row, disposition: dispositions.get(row.id) ?? PENDING_DISPOSITION }));
  return [{ path: 'fragments/fragments.json', content: stableRowsJson(withDisposition) }];
}

async function structuredFiles(projectId: string): Promise<DataFile[]> {
  const db = getDb();
  const specRows = await db.select().from(specs).where(eq(specs.projectId, projectId));
  const specIds = specRows.map((row) => row.id);
  const targets = specIds.length ? await db.select().from(specTargets).where(inArray(specTargets.specId, specIds)) : [];
  const acceptance = specIds.length ? await db.select().from(specAcceptance).where(inArray(specAcceptance.specId, specIds)) : [];
  const domainRows = await db.select().from(domains).where(eq(domains.projectId, projectId));
  const dataDesignRows = await db.select().from(dataDesigns).where(eq(dataDesigns.projectId, projectId));
  return [
    { path: 'structured/specs.json', content: stableRowsJson(specRows) },
    { path: 'structured/spec-targets.json', content: stableRowsJson(targets) },
    { path: 'structured/spec-acceptance.json', content: stableRowsJson(acceptance) },
    { path: 'structured/domains.json', content: stableRowsJson(domainRows) },
    { path: 'structured/data-design.json', content: stableRowsJson(dataDesignRows) },
  ];
}

async function uxAndScenarioFiles(project: Project): Promise<DataFile[]> {
  const db = getDb();
  const scenarios = await db.select().from(uxScenarios).where(eq(uxScenarios.projectId, project.id));
  const ids = scenarios.map((row) => row.id);
  const scoped = async <T>(load: () => Promise<T[]>): Promise<T[]> => (ids.length ? load() : []);
  const useCases = await scoped(() => db.select().from(uxUseCases).where(inArray(uxUseCases.scenarioId, ids)));
  const canvases = await scoped(() => db.select().from(uxCanvases).where(inArray(uxCanvases.scenarioId, ids)));
  const proposals = await scoped(() => db.select().from(uxBoundaryProposals).where(inArray(uxBoundaryProposals.scenarioId, ids)));
  const decisions = await scoped(() => db.select().from(uxBoundaryDecisions).where(inArray(uxBoundaryDecisions.scenarioId, ids)));
  const evidence = await scoped(() => db.select().from(uxEvidence).where(inArray(uxEvidence.scenarioId, ids)));
  return [
    { path: 'ux/goal.json', content: stableJson(uxGoalOf(project)) },
    { path: 'ux/boundary-proposals.json', content: stableRowsJson(proposals) },
    { path: 'ux/boundary-decisions.json', content: stableRowsJson(decisions) },
    { path: 'ux/evidence.json', content: stableRowsJson(evidence) },
    { path: 'scenarios/scenarios.json', content: stableRowsJson(scenarios) },
    { path: 'scenarios/use-cases.json', content: stableRowsJson(useCases) },
    { path: 'scenarios/canvases.json', content: stableRowsJson(canvases) },
  ];
}

async function sceneFiles(projectId: string): Promise<DataFile[]> {
  const db = getDb();
  const layoutRows = await db.select().from(layouts).where(eq(layouts.projectId, projectId));
  const objectRows = await db.select().from(objects).where(eq(objects.projectId, projectId));
  const layoutIds = layoutRows.map((row) => row.id);
  const objectIds = objectRows.map((row) => row.id);
  const placed = layoutIds.length ? await db.select().from(layoutObjects).where(inArray(layoutObjects.layoutId, layoutIds)) : [];
  const attrs = objectIds.length ? await db.select().from(objectAttrs).where(inArray(objectAttrs.objectId, objectIds)) : [];
  const documents = await db.select().from(sceneDocuments).where(eq(sceneDocuments.projectId, projectId));
  const transitionRows = await db.select().from(transitions).where(eq(transitions.projectId, projectId));
  return [
    { path: 'scenes/layouts.json', content: stableRowsJson(layoutRows) },
    { path: 'scenes/layout-objects.json', content: stableRowsJson(placed) },
    { path: 'scenes/objects.json', content: stableRowsJson(objectRows) },
    { path: 'scenes/object-attrs.json', content: stableRowsJson(attrs) },
    { path: 'scenes/scene-documents.json', content: stableRowsJson(documents) },
    { path: 'scenes/transitions.json', content: stableRowsJson(transitionRows) },
  ];
}

export function withManifest(project: Pick<Project, 'id' | 'name'>, files: readonly DataFile[]): DataFile[] {
  const manifest = { format: FORMAT, project: { id: project.id, name: project.name }, files: files.map((file) => file.path).sort() };
  return [...files, { path: DATA_MANIFEST_PATH, content: stableJson(manifest) }];
}

export async function buildProjectDataFiles(project: Project): Promise<DataFile[]> {
  return withManifest(project, [
    ...await fragmentFiles(project.id),
    ...await structuredFiles(project.id),
    ...await uxAndScenarioFiles(project),
    ...await sceneFiles(project.id),
  ]);
}
