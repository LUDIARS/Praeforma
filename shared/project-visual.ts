// プロジェクトのビジュアル素材 (spec/feature/project-visuals.md)。
// コンセプトアート / キービジュアル / スクリーンショットを登録し、企画概要書の候補に使う (PF-VIS-1〜5)。
// 画像の種類・1 枚の大きさは企画概要書の画面の候補と同じ決まり (shared/concept-sheet.ts) に揃える。
import { SCENE_IMAGE_MAX_BYTES, SCENE_IMAGE_TYPES, SCENE_IMAGES_MAX, SCENE_LABEL_MAX, type SceneImageType } from './concept-sheet.ts';

export const VISUAL_KINDS = ['key_visual', 'concept_art', 'screenshot'] as const;
export type VisualKind = typeof VISUAL_KINDS[number];

export const VISUAL_KIND_LABELS: Record<VisualKind, string> = {
  key_visual: 'キービジュアル',
  concept_art: 'コンセプトアート',
  screenshot: 'スクリーンショット',
};

export const VISUAL_IMAGE_TYPES = SCENE_IMAGE_TYPES;
export const VISUAL_LIMITS = {
  label: SCENE_LABEL_MAX,
  note: 1000,
  perProject: 30,
  imageBytes: SCENE_IMAGE_MAX_BYTES,
} as const;

/** 一覧で返す形。画像の中身 (data URL) は含めない (1 枚 4MB までを 30 枚まで持てるため)。 */
export interface ProjectVisual {
  id: string;
  kind: VisualKind;
  label: string;
  note: string;
  /** 一押し: 人が「一番面白そう」と選んだ印。企画概要書の候補の既定で先に選ばれる。 */
  featured: boolean;
  mimeType: SceneImageType;
  byteSize: number;
  digest: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVisualWithImage extends ProjectVisual { dataUrl: string }

/**
 * 企画概要書の候補の既定 (PF-VIS-5)。キービジュアル → 一押し → コンセプトアート の順に、最大 max 枚。
 * それぞれの中は新しく登録した順。どれにも当たらなければ空 (人が選ぶ)。
 */
export function defaultCandidateVisualIds(visuals: readonly ProjectVisual[], max: number = SCENE_IMAGES_MAX): string[] {
  const newestFirst = [...visuals].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const groups = [
    newestFirst.filter((v) => v.kind === 'key_visual'),
    newestFirst.filter((v) => v.featured),
    newestFirst.filter((v) => v.kind === 'concept_art'),
  ];
  const picked: string[] = [];
  for (const visual of groups.flat()) {
    if (picked.length >= max) break;
    if (!picked.includes(visual.id)) picked.push(visual.id);
  }
  return picked;
}
