// 企画概要書の材料 (プロジェクト名・キャッチコピー・UX/ゴール・コアドメインの価値) を読み、生成時と比べて鮮度を出す
// (PF-CS-1 / PF-CS-7)。キャッチコピーは文言だけを鮮度に入れる (origin が AI案 → 人 に変わっただけでは古くならない)。
import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { projects } from '../db/schema/project.ts';
import { domains } from '../db/schema/domain.ts';
import type { ConceptSheetFreshness, ConceptSheetSource } from '../../../shared/concept-sheet.ts';
import { AppError } from './errors.ts';
import type { CatchcopyOrigin } from '../../../shared/catchcopy.ts';

export interface ConceptSheetMaterial {
  projectName: string;
  catchcopy: { text: string; origin: CatchcopyOrigin };
  ux: { experience: string; story: string; emotions: string; design: string; goal: string };
  cores: Array<{ name: string; value: string }>;
  revision: number;
  digest: string;
}

export async function readConceptSheetMaterial(projectId: string): Promise<ConceptSheetMaterial> {
  const [row] = await getDb().select({
    name: projects.name, experience: projects.uxExperience, story: projects.uxStory, emotions: projects.uxEmotions,
    design: projects.uxDesign, goal: projects.uxGoal, revision: projects.uxGoalRevision,
    catchcopy: projects.uxCatchcopy, catchcopyOrigin: projects.uxCatchcopyOrigin,
  }).from(projects).where(and(eq(projects.id, projectId), isNull(projects.deletedAt))).limit(1);
  if (!row) throw AppError.notFound('project_not_found');
  const coreRows = await getDb().select({ name: domains.name, value: domains.definitionValue }).from(domains)
    .where(and(eq(domains.projectId, projectId), eq(domains.definitionKind, 'core')));
  const cores = coreRows.map((c) => ({ name: c.name, value: c.value })).sort((a, b) => a.name.localeCompare(b.name));
  const ux = { experience: row.experience, story: row.story, emotions: row.emotions, design: row.design, goal: row.goal };
  return { projectName: row.name, catchcopy: { text: row.catchcopy, origin: row.catchcopyOrigin }, ux, cores, revision: row.revision,
    digest: createHash('sha256').update(JSON.stringify([row.name, row.catchcopy, ux, cores])).digest('hex') };
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
