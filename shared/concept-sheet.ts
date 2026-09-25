// 企画概要書 (ペライチのコンセプトシート) の文書契約 (spec/feature/concept-sheet.md)。
// 1 ページに収めるため、各欄に字数と個数の上限を持つ。PF-CS-3。
import { z } from 'zod';

export const CONCEPT_SHEET_LIMITS = {
  title: 40, catchcopy: 40, lead: 120, target: 100, goal: 140, visualCaption: 80,
  hookHeading: 20, hookText: 90, hooksMin: 2, hooksMax: 4,
  journeyScene: 16, journeyText: 70, journeyMin: 3, journeyMax: 5,
  emotion: 16, emotionsMin: 2, emotionsMax: 6,
} as const;
const L = CONCEPT_SHEET_LIMITS;

/** 読み手に見せる文だけを持つ。出典や生成条件は source に分ける。 */
export interface ConceptSheetDocument {
  title: string;
  catchcopy: string;
  lead: string;
  target: string;
  hooks: Array<{ heading: string; text: string }>;
  journey: Array<{ scene: string; text: string }>;
  emotions: string[];
  goal: string;
  /** キービジュアルが体験のどこを表しているか。キービジュアルが無ければ空。 */
  visualCaption: string;
}

// 文書は HTML に埋め込むので、 タグらしき文字列と制御文字をここで拒否する (出力側でもエスケープする)。
const plain = (max: number, min = 1) => z.string().trim().min(min).max(max)
  .refine((v) => !/[<>]|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), 'plain_text_only');

export const conceptSheetDocumentSchema = z.object({
  title: plain(L.title),
  catchcopy: plain(L.catchcopy),
  lead: plain(L.lead),
  target: plain(L.target),
  hooks: z.array(z.object({ heading: plain(L.hookHeading), text: plain(L.hookText) }).strict()).min(L.hooksMin).max(L.hooksMax),
  journey: z.array(z.object({ scene: plain(L.journeyScene), text: plain(L.journeyText) }).strict()).min(L.journeyMin).max(L.journeyMax),
  emotions: z.array(plain(L.emotion)).min(L.emotionsMin).max(L.emotionsMax),
  goal: plain(L.goal),
  visualCaption: plain(L.visualCaption, 0),
}).strict();

export const KEY_VISUAL_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type KeyVisualType = typeof KEY_VISUAL_TYPES[number];
/** 画像の実体の上限。data URL にすると約 4/3 倍になる。 */
export const KEY_VISUAL_MAX_BYTES = 4 * 1024 * 1024;

export interface ConceptSheetKeyVisual { dataUrl: string; mimeType: KeyVisualType; digest: string }

/** どの UX/ゴールとキービジュアルから作ったか。鮮度の判定に使う。 */
export interface ConceptSheetSource {
  uxGoalRevision: number;
  uxDigest: string;
  keyVisualDigest: string | null;
  skillDigest: string;
}

export type ConceptSheetStatus = 'generated' | 'edited';
export type ConceptSheetFreshness = 'current' | 'outdated';

export interface ConceptSheetRecord {
  id: string;
  projectId: string;
  revision: number;
  updatedAt: string;
  status: ConceptSheetStatus;
  document: ConceptSheetDocument;
  keyVisual: ConceptSheetKeyVisual | null;
  source: ConceptSheetSource;
  freshness: ConceptSheetFreshness;
}

export interface ConceptSheetSummary {
  id: string;
  title: string;
  catchcopy: string;
  status: ConceptSheetStatus;
  updatedAt: string;
  freshness: ConceptSheetFreshness;
  hasKeyVisual: boolean;
}
