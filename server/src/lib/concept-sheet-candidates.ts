// 企画概要書の画面の候補 (spec/feature/concept-sheet.md PF-CS-12)。登録したビジュアルから最大 6 枚を使う。
// - 人が選んだもの (resolveSelectedVisuals)
// - 前回の版の候補 (resolveBaseCandidates): 作り直しの「前回の候補を使う」と自動更新。消えたものは外し、
//   残らなければ既定 (キービジュアル → 一押し → コンセプトアート) を使う。
//   前の形の行 (画像を行の中に持つ) は、その画像をビジュアルへ移して (同じ画像は二重に登録しない) 候補にする。
import { ulid } from 'ulid';
import type { ConceptSheetImage, ConceptSheetVisualRef } from '../../../shared/concept-sheet.ts';
import { defaultCandidateVisualIds, VISUAL_LIMITS } from '../../../shared/project-visual.ts';
import { findProjectVisuals, findVisualByDigest, listProjectVisuals, type VisualRow } from '../db/project-visual-reads.ts';
import { insertProjectVisual } from '../db/project-visual-persistence.ts';
import { decodeSceneImage, decodeSceneImages, type DecodedSceneImage } from './concept-sheet-input.ts';
import { AppError } from './errors.ts';

/** 生成に渡す 1 枚。ref は版に残す指し先 (画像は複製しない)。 */
export interface SceneCandidate { image: DecodedSceneImage; ref: ConceptSheetVisualRef; featured: boolean }

/** 保存済みの画像も入力と同じ確認 (種類・中身・大きさ・合計) を通してから使う。 */
function toCandidates(rows: VisualRow[]): SceneCandidate[] {
  const decoded = decodeSceneImages(rows.map((r) => ({ label: r.label, dataUrl: r.dataUrl })));
  return rows.map((r, i) => ({
    image: decoded[i]!, featured: r.featured,
    ref: { visualId: r.id, digest: r.digest, kind: r.kind, label: r.label, note: r.note },
  }));
}

/** ids の順に、削除していない行を並べる。見つからないものは落とす。 */
async function inOrder(projectId: string, ids: string[]): Promise<VisualRow[]> {
  const byId = new Map((await findProjectVisuals(projectId, ids)).map((r) => [r.id, r]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** 人が選んだビジュアル (選んだ順)。重複・削除済み・別プロジェクトのものは 400。 */
export async function resolveSelectedVisuals(projectId: string, visualIds: string[]): Promise<SceneCandidate[]> {
  if (new Set(visualIds).size !== visualIds.length) throw AppError.badRequest('invalid_visual_selection');
  const rows = await inOrder(projectId, visualIds);
  if (rows.length !== visualIds.length) throw AppError.badRequest('invalid_visual_selection');
  return toCandidates(rows);
}

/** 前の形の行が持つ画像をビジュアル (スクリーンショット) へ移す。同じ画像が登録済みならそれを使う。 */
async function importLegacyImages(projectId: string, images: ConceptSheetImage[], createdBy: string): Promise<string[]> {
  const ids: string[] = [];
  for (const legacy of images) {
    const { image, bytes } = decodeSceneImage(legacy.label, legacy.dataUrl);
    const existing = await findVisualByDigest(projectId, image.digest);
    if (existing) { ids.push(existing.id); continue; }
    const id = ulid();
    await insertProjectVisual({ id, projectId, kind: 'screenshot', label: image.label.slice(0, VISUAL_LIMITS.label), note: '',
      featured: false, image: { ...image, byteSize: bytes.byteLength }, createdBy });
    ids.push(id);
  }
  return ids;
}

/** 前回の版の候補。残っていなければ既定、それも無ければ 422 (ビジュアルを登録してもらう)。 */
export async function resolveBaseCandidates(projectId: string,
  base: { visualRefs?: ConceptSheetVisualRef[]; images?: ConceptSheetImage[] }, createdBy: string): Promise<SceneCandidate[]> {
  const ids = base.visualRefs?.length ? base.visualRefs.map((r) => r.visualId)
    : base.images?.length ? await importLegacyImages(projectId, base.images, createdBy) : [];
  let rows = await inOrder(projectId, ids);
  if (rows.length === 0) rows = await inOrder(projectId, defaultCandidateVisualIds(await listProjectVisuals(projectId)));
  if (rows.length === 0) throw new AppError('concept_sheet_visuals_required', 422);
  return toCandidates(rows);
}
