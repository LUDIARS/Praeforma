// 企画概要書を 1 回作って版を 1 つ足す (spec/feature/concept-sheet.md PF-CS-1 / PF-CS-4 / PF-CS-6 / PF-CS-10 / PF-CS-11)。
// 人の作成・作り直しと自動更新が同じ手順を使う。裏で走るので、呼ぶ側 (ConceptSheetJobs) が失敗を状態に残す。
// - UX (キャッチコピー・制約を含む) が生成中に変わったら保存しない (キャッチコピーの固定を崩さないため)。
// - 仕様・ビジュアルが生成中に変わったときは保存し、紙面は「古い」になる (次の自動更新で直す)。
import type { AuthIdentity } from '../auth/paseto.ts';
import type { ConceptSheetDesign, ConceptSheetSource } from '../../../shared/concept-sheet.ts';
import { persistConceptSheetVersion } from '../db/concept-sheet-persistence.ts';
import { fillEmptyCatchcopy } from '../db/project-catchcopy-persistence.ts';
import { findSheetRow } from '../db/concept-sheet-reads.ts';
import { recordAudit } from './audit.ts';
import { AppError } from './errors.ts';
import { imagesDigest } from './concept-sheet-input.ts';
import { readConceptSheetMaterial, assertMaterialPresent, type ConceptSheetMaterial } from './concept-sheet-sources.ts';
import { resolveBaseCandidates, type SceneCandidate } from './concept-sheet-candidates.ts';
import type { ConceptSheetWriter } from './concept-sheet-writer.ts';

export interface GenerationPlan {
  projectId: string;
  sheetId: string;
  expectedRevision: number;
  kind: 'create' | 'regenerate' | 'auto';
  candidates: SceneCandidate[];
  material: ConceptSheetMaterial;
  instructions: string;
  previous: ConceptSheetDesign | null;
  actor: AuthIdentity;
}

/** 自動更新の書き手。監査と版の created_by に残る。 */
export const AUTO_UPDATE_ACTOR: AuthIdentity = {
  userId: 'system:concept-sheet-auto-update', role: 'system', displayName: '自動更新', projectKey: null,
};

/** 最新版を土台にした作り直しの計画 (候補は前回のもの、紙面は前回のもの)。自動更新と「前回の候補を使う」が使う。 */
export async function planFromLatest(projectId: string, sheetId: string, options: {
  kind: 'regenerate' | 'auto'; instructions: string; actor: AuthIdentity; expectedRevision?: number;
}): Promise<GenerationPlan> {
  const head = await findSheetRow(projectId, sheetId);
  if (!head) throw AppError.notFound('concept_sheet_not_found');
  if (options.expectedRevision !== undefined && head.revision !== options.expectedRevision) {
    throw AppError.conflict('concept_sheet_revision_conflict');
  }
  // UX が空なら候補を用意する前に止める (前の形の画像をビジュアルへ移す書き込みを無駄にしない)。
  const material = await readConceptSheetMaterial(projectId);
  assertMaterialPresent(material);
  const candidates = await resolveBaseCandidates(projectId, head.payload, options.actor.userId);
  return { projectId, sheetId, expectedRevision: head.revision, kind: options.kind, candidates, material,
    instructions: options.instructions, previous: head.payload.design, actor: options.actor };
}

export async function runConceptSheetGeneration(plan: GenerationPlan, writer: ConceptSheetWriter): Promise<void> {
  const { projectId, material, candidates } = plan;
  const generated = await writer({ material, images: candidates.map((c) => c.image), instructions: plan.instructions,
    candidates: candidates.map((c) => ({ kind: c.ref.kind, note: c.ref.note, featured: c.featured })),
    previous: plan.previous, mode: plan.kind === 'auto' ? 'auto' : 'manual' });
  let current = await readConceptSheetMaterial(projectId);
  if (current.digest !== material.digest) throw AppError.conflict('concept_sheet_source_changed');
  const filled = !material.catchcopy.text;
  if (filled) {
    // 空欄だけを AI案 で埋める。人が生成中に書いていたら、その文言を優先してこのシートは保存しない。
    if (!await fillEmptyCatchcopy(projectId, generated.design.catchcopy, material.revision)) {
      throw AppError.conflict('concept_sheet_source_changed');
    }
    current = await readConceptSheetMaterial(projectId);
  }
  const images = candidates.map((c) => c.image.image);
  // 仕様の digest は、Astra に渡した (生成を始めたときの) ものを残す。途中で変わっていれば、この版は古いと出る。
  const source: ConceptSheetSource = { uxGoalRevision: current.revision, uxDigest: current.digest, specDigest: material.specDigest,
    imagesDigest: imagesDigest(images), skillDigest: generated.skillDigest, model: generated.model, instructions: plan.instructions };
  const saved = await persistConceptSheetVersion({ id: plan.sheetId, projectId, expectedRevision: plan.expectedRevision,
    kind: plan.kind, createdBy: plan.actor.userId, design: generated.design, source, visualRefs: candidates.map((c) => c.ref) });
  await recordAudit({ projectId, actor: plan.actor, action: plan.kind === 'auto' ? 'concept_sheet.auto_update' : 'concept_sheet.generate',
    targetKind: 'concept_sheet', targetId: plan.sheetId, meta: { revision: saved.revision, rv: saved.rv, kind: plan.kind,
      uxGoalRevision: current.revision, images: images.length, model: generated.model, catchcopyFilled: filled } });
}

/** 自動更新の 1 枚: 最新版の紙面と候補を土台に作り直し、次の版にする。 */
export function makeAutoRegenerate(writer: ConceptSheetWriter): (projectId: string, sheetId: string) => Promise<void> {
  return async (projectId, sheetId) => runConceptSheetGeneration(
    await planFromLatest(projectId, sheetId, { kind: 'auto', instructions: '', actor: AUTO_UPDATE_ACTOR }), writer);
}
