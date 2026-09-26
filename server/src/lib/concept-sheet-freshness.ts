// 企画概要書の鮮度 (spec/feature/concept-sheet.md PF-CS-7 / PF-CS-11)。
// 作った後に UX (企画の制約を含む)・仕様の見出し/分類/状態・使っているビジュアル (名前・種類・メモ・削除) が
// 変わったら「古い」。古いものは画面で「UXが更新済み」と出し、自動更新が ON なら作り直す。
import type { ConceptSheetFreshness, ConceptSheetSource, ConceptSheetVisualRef } from '../../../shared/concept-sheet.ts';
import type { VisualKind } from '../../../shared/project-visual.ts';
import { readConceptSheetMaterial } from './concept-sheet-sources.ts';
import { findVisualMeta } from '../db/project-visual-reads.ts';

export interface VisualNow { kind: VisualKind; label: string; note: string; deleted: boolean }
export interface FreshnessBasis { uxDigest: string; specDigest: string; visuals: ReadonlyMap<string, VisualNow> }

/** 今の材料の digest と、refs が指すビジュアルの今の名前などを読む。 */
export async function readFreshnessBasis(projectId: string, refs: readonly ConceptSheetVisualRef[]): Promise<FreshnessBasis> {
  const material = await readConceptSheetMaterial(projectId);
  const rows = await findVisualMeta(projectId, refs.map((r) => r.visualId));
  const visuals = new Map(rows.map((r) => [r.id, { kind: r.kind, label: r.label, note: r.note, deleted: r.deletedAt !== null }]));
  return { uxDigest: material.digest, specDigest: material.specDigest, visuals };
}

/** 純関数。specDigest の無い版 (仕様を材料にする前に作ったもの) は、仕様を反映していないので古いと扱う。 */
export function freshnessOf(source: ConceptSheetSource, refs: readonly ConceptSheetVisualRef[], basis: FreshnessBasis): ConceptSheetFreshness {
  if (source.uxDigest !== basis.uxDigest || source.specDigest !== basis.specDigest) return 'outdated';
  const changed = refs.some((ref) => {
    const now = basis.visuals.get(ref.visualId);
    return !now || now.deleted || now.kind !== ref.kind || now.label !== ref.label || now.note !== ref.note;
  });
  return changed ? 'outdated' : 'current';
}
