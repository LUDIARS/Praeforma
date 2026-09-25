// 企画概要書の材料 (UX/ゴール) を読み、生成時の版と比べて鮮度を出す (PF-CS-1 / PF-CS-7)。
import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { projects } from '../db/schema/project.ts';
import type { ConceptSheetFreshness, ConceptSheetSource } from '../../../shared/concept-sheet.ts';
import { AppError } from './errors.ts';

export interface ConceptSheetMaterial {
  projectName: string;
  ux: { experience: string; story: string; emotions: string; design: string; goal: string };
  revision: number;
  digest: string;
}

export async function readConceptSheetMaterial(projectId: string): Promise<ConceptSheetMaterial> {
  const [row] = await getDb().select({
    name: projects.name, experience: projects.uxExperience, story: projects.uxStory, emotions: projects.uxEmotions,
    design: projects.uxDesign, goal: projects.uxGoal, revision: projects.uxGoalRevision,
  }).from(projects).where(and(eq(projects.id, projectId), isNull(projects.deletedAt))).limit(1);
  if (!row) throw AppError.notFound('project_not_found');
  const ux = { experience: row.experience, story: row.story, emotions: row.emotions, design: row.design, goal: row.goal };
  return { projectName: row.name, ux, revision: row.revision,
    digest: createHash('sha256').update(JSON.stringify([row.name, ux])).digest('hex') };
}

/** UX/ゴールが空ならシートを作らない。AI に未定義の体験を埋めさせない (PF-GOAL-INV3)。 */
export function assertMaterialPresent(material: ConceptSheetMaterial): void {
  if (!material.ux.experience.trim() && !material.ux.design.trim() && !material.ux.goal.trim()) {
    throw new AppError('concept_sheet_ux_empty', 422);
  }
}

export async function conceptSheetFreshness(projectId: string, source: ConceptSheetSource): Promise<ConceptSheetFreshness> {
  const current = await readConceptSheetMaterial(projectId);
  return current.digest === source.uxDigest ? 'current' : 'outdated';
}
