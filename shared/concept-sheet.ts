// 企画概要書 (ペライチのコンセプトシート) の契約 (spec/feature/concept-sheet.md)。
// 2026-09-26 neco 指示で、文面とレイアウトは Astra (gpt-6-astra) が設計する HTML にした。
// Pf は材料 (UX/ゴール・画面の候補) を渡し、Astra の出力を検証して保存・表示する。PF-CS-3。

/** 画面の候補 (現状のツール UI / ゲーム画面)。Astra が一番いいシーンを選ぶ。 */
export const SCENE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type SceneImageType = typeof SCENE_IMAGE_TYPES[number];
export const SCENE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const SCENE_IMAGES_MAX = 6;
export const SCENE_IMAGES_TOTAL_MAX_BYTES = 16 * 1024 * 1024;
export const SCENE_LABEL_MAX = 60;
export const INSTRUCTIONS_MAX = 2000;

export interface ConceptSheetImage { label: string; dataUrl: string; mimeType: SceneImageType; digest: string }

/** Astra が選んだシーン。index は images の添字。 */
export interface ConceptSheetSceneChoice { index: number; label: string; reason: string }

/** Astra が設計した 1 枚。html の画像は {{IMAGE_n}} の差し込み口で持ち、表示時に埋める。 */
export interface ConceptSheetDesign {
  title: string;
  catchcopy: string;
  concept: string;
  scene: ConceptSheetSceneChoice;
  /** 載せた項目の見出し (ポイント / ゴール / 体験設計 / 感情効果 / ストーリー など、コンテンツで出し分けたもの)。 */
  sections: string[];
  html: string;
}

export const DESIGN_LIMITS = { title: 60, catchcopy: 80, concept: 300, reason: 300, section: 30, sectionsMax: 10, htmlBytes: 300_000 } as const;

/** どの UX/ゴール・画面・執筆規則・モデルから作ったか。鮮度の判定に使う。 */
export interface ConceptSheetSource {
  uxGoalRevision: number;
  uxDigest: string;
  imagesDigest: string;
  skillDigest: string;
  model: string;
  instructions: string;
}

export type ConceptSheetFreshness = 'current' | 'outdated';

export interface ConceptSheetRecord {
  id: string;
  projectId: string;
  revision: number;
  updatedAt: string;
  design: ConceptSheetDesign;
  images: ConceptSheetImage[];
  source: ConceptSheetSource;
  freshness: ConceptSheetFreshness;
}

export interface ConceptSheetSummary {
  id: string;
  title: string;
  catchcopy: string;
  concept: string;
  sceneLabel: string;
  updatedAt: string;
  freshness: ConceptSheetFreshness;
}
