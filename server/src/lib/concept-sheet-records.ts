// 企画概要書の 1 つの版を、画面・出力に渡す形にする (spec/feature/concept-sheet.md PF-CS-10)。
// 画像は版に複製していないので、版が指すビジュアル (削除済みの印の行も含む) から、版を作ったときの中身を引く。
// migration 021 で写した rv1 は画像を版の中に持つので、それを使う。
import type { ConceptSheetImage, ConceptSheetRecord } from '../../../shared/concept-sheet.ts';
import { findVersionRow, type SheetRow, type VersionRow } from '../db/concept-sheet-reads.ts';
import { findProjectVisuals } from '../db/project-visual-reads.ts';
import { readFreshnessBasis, freshnessOf } from './concept-sheet-freshness.ts';

/** 版が指すビジュアルの画像 (添字が {{IMAGE_n}})。中身が版の digest と違う・行が無いものは空にする (紙面には埋めない)。 */
export async function loadVersionImages(projectId: string, version: Pick<VersionRow, 'payload' | 'visualRefs'>): Promise<ConceptSheetImage[]> {
  if (version.payload.images) return version.payload.images;
  const rows = await findProjectVisuals(projectId, version.visualRefs.map((r) => r.visualId), true);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return version.visualRefs.map((ref) => {
    const row = byId.get(ref.visualId);
    return row && row.digest === ref.digest
      ? { label: ref.label, dataUrl: row.dataUrl, mimeType: row.mimeType, digest: row.digest }
      : { label: ref.label, dataUrl: '', mimeType: 'image/png', digest: ref.digest };
  });
}

/**
 * 最新版の行から版の形を作る。最新版の版の行が無いとき (migration 021 を流す前のサーバが後から書いた行など) に使う。
 * 最新版の行は版と同じ紙面・出典・候補を持つ。
 */
function versionFromHead(head: SheetRow): VersionRow {
  return { sheetId: head.id, rv: head.latestRv, projectId: head.projectId, kind: 'migrated', createdBy: '', createdAt: head.updatedAt,
    payload: { design: head.payload.design, source: head.payload.source, ...(head.payload.images ? { images: head.payload.images } : {}) },
    visualRefs: head.payload.visualRefs ?? [] };
}

/** 版 rv の紙面。無い版なら undefined。鮮度は今の材料と比べる (古い版はふつう「古い」)。 */
export async function readConceptSheetRecord(head: SheetRow, rv: number): Promise<ConceptSheetRecord | undefined> {
  const version = (await findVersionRow(head.id, rv)) ?? (rv === head.latestRv ? versionFromHead(head) : undefined);
  if (!version) return undefined;
  const images = await loadVersionImages(head.projectId, version);
  const basis = await readFreshnessBasis(head.projectId, version.visualRefs);
  return {
    id: head.id, projectId: head.projectId, revision: head.revision, updatedAt: head.updatedAt.toISOString(),
    rv: version.rv, latestRv: head.latestRv, kind: version.kind, createdAt: version.createdAt.toISOString(), autoUpdate: head.autoUpdate,
    design: version.payload.design, images, visuals: version.visualRefs, source: version.payload.source,
    freshness: freshnessOf(version.payload.source, version.visualRefs, basis),
  };
}
