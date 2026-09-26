// 企画概要書の材料 (プロジェクト名・キャッチコピー・UX/ゴール・コアドメインの価値・仕様) を読む (PF-CS-1 / PF-CS-7)。
// キャッチコピーは文言だけを鮮度に入れる (origin が AI案 → 人 に変わっただけでは古くならない)。
// PF-GOAL-W4 以降は、ターゲットユーザーと企画の制約 (UX を縛るもの) も材料と鮮度に入れる。
// PF-CS-11 以降は、仕様の見出し・分類・状態 (本文は入れない、上限 100 件) も材料に入れる。鮮度は specDigest で別に持つ
// (生成中に仕様が変わっても作ったものは保存し、次の自動更新で直す。UX の変化は従来どおり保存しない)。
import { createHash } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { projects } from '../db/schema/project.ts';
import { domains } from '../db/schema/domain.ts';
import { specs } from '../db/schema/spec.ts';
import { projectConstraints } from '../db/schema/project-constraint.ts';
import { SPEC_MATERIAL_MAX } from '../../../shared/concept-sheet.ts';
import { AppError } from './errors.ts';
import type { CatchcopyOrigin } from '../../../shared/catchcopy.ts';

/** 材料に入れる仕様 1 件。本文・コード・受け入れ条件は入れない。 */
export interface SpecMaterial { title: string; category: string; status: string }

export interface ConceptSheetMaterial {
  projectName: string;
  catchcopy: { text: string; origin: CatchcopyOrigin };
  ux: { target: string; experience: string; story: string; emotions: string; design: string; goal: string };
  /** 企画の制約 (UX を縛るもの)。作った順。 */
  planningConstraints: Array<{ title: string; detail: string }>;
  cores: Array<{ name: string; value: string }>;
  /** 仕様の見出し・分類・状態 (コード順に最大 SPEC_MATERIAL_MAX 件)。 */
  specs: SpecMaterial[];
  revision: number;
  /** UX (名前・キャッチコピーの文言・UX の文章欄・コアドメインの価値・企画の制約) の digest。 */
  digest: string;
  /** specs の digest。 */
  specDigest: string;
}

const sha256 = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** 仕様の見出し・分類・状態 (削除していないもの、コード順、上限あり)。 */
export async function readSpecMaterial(projectId: string): Promise<{ specs: SpecMaterial[]; specDigest: string }> {
  const rows = await getDb().select({ title: specs.title, category: specs.category, status: specs.status }).from(specs)
    .where(and(eq(specs.projectId, projectId), isNull(specs.deletedAt)))
    .orderBy(asc(specs.code), asc(specs.id)).limit(SPEC_MATERIAL_MAX);
  const list = rows.map((r) => ({ title: r.title, category: r.category, status: r.status }));
  return { specs: list, specDigest: sha256(list) };
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
  const spec = await readSpecMaterial(projectId);
  return { projectName: row.name, catchcopy: { text: row.catchcopy, origin: row.catchcopyOrigin }, ux, cores, planningConstraints,
    specs: spec.specs, revision: row.revision, specDigest: spec.specDigest,
    digest: sha256([row.name, row.catchcopy, ux, cores, planningConstraints]) };
}

/** UX が空ならシートを作らない。AI に未定義の体験を埋めさせない (PF-GOAL-INV3)。 */
export function assertMaterialPresent(material: ConceptSheetMaterial): void {
  const { target, story, experience, design, goal } = material.ux;
  if (![material.catchcopy.text, target, story, experience, design, goal].some((text) => text.trim())) {
    throw new AppError('concept_sheet_ux_empty', 422);
  }
}
