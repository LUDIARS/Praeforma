// 企画概要書の材料 (プロジェクト名・キャッチコピー・UX/ゴール・コアドメインの価値) を読み、生成時と比べて鮮度を出す
// (PF-CS-1 / PF-CS-7)。キャッチコピーは文言だけを鮮度に入れる (origin が AI案 → 人 に変わっただけでは古くならない)。
// PF-GOAL-W4 以降は、ターゲットユーザーと企画の制約 (UX を縛るもの) も材料と鮮度に入れる。
import { createHash } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { projects } from '../db/schema/project.ts';
import { domains } from '../db/schema/domain.ts';
import { projectConstraints } from '../db/schema/project-constraint.ts';
import type { ConceptSheetFreshness, ConceptSheetSource } from '../../../shared/concept-sheet.ts';
import { AppError } from './errors.ts';
import type { CatchcopyOrigin } from '../../../shared/catchcopy.ts';

export interface ConceptSheetMaterial {
  projectName: string;
  catchcopy: { text: string; origin: CatchcopyOrigin };
  ux: { target: string; experience: string; story: string; emotions: string; design: string; goal: string };
  /** 企画の制約 (UX を縛るもの)。作った順。 */
  planningConstraints: Array<{ title: string; detail: string }>;
  cores: Array<{ name: string; value: string }>;
  revision: number;
  digest: string;
}

export async function readConceptSheetMaterial(projectId: string): Promise<ConceptSheetMaterial> {
  const [row] = await getDb().select({
    name: projects.name, experience: projects.uxExperience, story: projects.uxStory, emotions: projects.uxEmotions,
    design: projects.uxDesign, goal: projects.uxGoal, revision: projects.uxGoalRevision,
    catchcopy: projects.uxCatchcopy, catchcopyOrigin: projects.uxCatchcopyOrigin, target: projects.uxTarget,
  }).from(projects).where(and(eq(projects.id, projectId), isNull(projects.deletedAt))).limit(1);
  if (!row) throw AppError.notFound('project_not_found');
  const coreRows = await getDb().select({ name: domains.name, value: domains.definitionValue }).from(domains)
    .where(and(eq(domains.projectId, projectId), eq(domains.definitionKind, 'core')));
  const cores = coreRows.map((c) => ({ name: c.name, value: c.value })).sort((a, b) => a.name.localeCompare(b.name));
  const constraintRows = await getDb().select({ title: projectConstraints.title, detail: projectConstraints.detail }).from(projectConstraints)
    .where(and(eq(projectConstraints.projectId, projectId), eq(projectConstraints.kind, 'planning')))
    .orderBy(asc(projectConstraints.createdAt), asc(projectConstraints.id));
  const planningConstraints = constraintRows.map((c) => ({ title: c.title, detail: c.detail }));
  const ux = { target: row.target, experience: row.experience, story: row.story, emotions: row.emotions, design: row.design, goal: row.goal };
  return { projectName: row.name, catchcopy: { text: row.catchcopy, origin: row.catchcopyOrigin }, ux, cores, planningConstraints,
    revision: row.revision,
    digest: createHash('sha256').update(JSON.stringify([row.name, row.catchcopy, ux, cores, planningConstraints])).digest('hex') };
}

/** UX が空ならシートを作らない。AI に未定義の体験を埋めさせない (PF-GOAL-INV3)。 */
export function assertMaterialPresent(material: ConceptSheetMaterial): void {
  const { target, story, experience, design, goal } = material.ux;
  if (![material.catchcopy.text, target, story, experience, design, goal].some((text) => text.trim())) {
    throw new AppError('concept_sheet_ux_empty', 422);
  }
}

export async function conceptSheetFreshness(projectId: string, source: ConceptSheetSource): Promise<ConceptSheetFreshness> {
  const current = await readConceptSheetMaterial(projectId);
  return current.digest === source.uxDigest ? 'current' : 'outdated';
}
