// 企画概要書 (ペライチのコンセプトシート) の契約 (spec/feature/concept-sheet.md)。
// 2026-09-26 neco 指示で、文面とレイアウトは Astra (gpt-6-astra) が設計する HTML にした。
// Pf は材料 (UX/ゴール・画面の候補) を渡し、Astra の出力を検証して保存・表示する。PF-CS-3。
// 2026-09-26 の追加指示で、企画概要書は版 (rv) で残し (PF-CS-10)、候補はビジュアル素材から選ぶ (PF-CS-12)。
import type { VisualKind } from './project-visual.ts';

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

/** どの UX/ゴール・仕様・画面・執筆規則・モデルから作ったか。鮮度の判定に使う。 */
export interface ConceptSheetSource {
  uxGoalRevision: number;
  uxDigest: string;
  /** 仕様の見出し・分類・状態の digest (PF-CS-11)。2026-09-26 より前の版には無い (無ければ「古い」と扱う)。 */
  specDigest?: string;
  imagesDigest: string;
  skillDigest: string;
  model: string;
  instructions: string;
}

export type ConceptSheetFreshness = 'current' | 'outdated';

/** 版を作ったきっかけ。migrated は migration 021 で既存の行を rv1 として写したもの。 */
export const CONCEPT_SHEET_VERSION_KINDS = ['create', 'regenerate', 'auto', 'migrated'] as const;
export type ConceptSheetVersionKind = typeof CONCEPT_SHEET_VERSION_KINDS[number];

/**
 * 版が使ったビジュアル (PF-CS-10)。添字が紙面の {{IMAGE_n}}。画像そのものは版に複製せず、
 * ビジュアルの id と中身の digest で指す。名前・種類・メモは版を作ったときのもの。
 */
export interface ConceptSheetVisualRef {
  visualId: string;
  digest: string;
  kind: VisualKind;
  label: string;
  note: string;
}

export interface ConceptSheetVersionSummary {
  rv: number;
  kind: ConceptSheetVersionKind;
  createdAt: string;
}

/** 企画概要書の 1 つの版。一覧の最新版も、切り替えた古い版も同じ形で返す。 */
export interface ConceptSheetRecord {
  id: string;
  projectId: string;
  /** 企画概要書 (最新版) の版一致に使う番号。rv とは別に数える。 */
  revision: number;
  updatedAt: string;
  /** この紙面の版 (rv1, rv2, …)。 */
  rv: number;
  latestRv: number;
  kind: ConceptSheetVersionKind;
  createdAt: string;
  autoUpdate: boolean;
  design: ConceptSheetDesign;
  /** 表示・出力に使う画像 (添字が {{IMAGE_n}})。版を作ったときの中身。 */
  images: ConceptSheetImage[];
  /** 使ったビジュアル。migration 021 で写した rv1 は空 (画像を版の中に持つ)。 */
  visuals: ConceptSheetVisualRef[];
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
  /** 最新版の番号。一覧は最新版を出す。 */
  rv: number;
  autoUpdate: boolean;
}

/** 生成・自動更新の状態 (PF-CS-9 / PF-CS-11)。trigger: 人の作成・作り直し (manual) / 自動更新 (auto)。 */
export type ConceptSheetJob =
  | { sheetId: string; trigger: 'manual' | 'auto'; state: 'running'; startedAt: string }
  | { sheetId: string; trigger: 'manual' | 'auto'; state: 'failed'; startedAt: string; finishedAt: string; error: string };

export interface ConceptSheetGenerationStatus {
  job: ConceptSheetJob | null;
  /** 自動更新の予約。最後の変更から静かな時間が過ぎたら走る。予約が無ければ null。 */
  autoUpdate: { scheduledAt: string | null };
}

/** 自動更新は、最後の変更からこの時間だけ静かになったら 1 回走る (Astra は 1 回数分〜十数分かかるため)。 */
export const AUTO_UPDATE_QUIET_MS = 10 * 60_000;
/** 材料に入れる仕様の上限 (見出し・分類・状態だけ。本文は入れない)。 */
export const SPEC_MATERIAL_MAX = 100;
