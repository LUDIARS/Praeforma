// 企画概要書 API の入力検証 (spec/feature/concept-sheet.md PF-CS-2)。
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  INSTRUCTIONS_MAX, SCENE_IMAGE_MAX_BYTES, SCENE_IMAGE_TYPES, SCENE_IMAGES_MAX, SCENE_IMAGES_TOTAL_MAX_BYTES, SCENE_LABEL_MAX,
  type ConceptSheetImage, type SceneImageType,
} from '../../../shared/concept-sheet.ts';
import { AppError } from './errors.ts';

const revision = z.number().int().min(0).max(2_147_483_646);
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/;
const sceneImage = z.object({
  label: z.string().trim().min(1).max(SCENE_LABEL_MAX),
  dataUrl: z.string().max(Math.ceil(SCENE_IMAGE_MAX_BYTES * 4 / 3) + 64),
}).strict();

/** images: 画面の候補 (1〜6 枚) / 'keep' = 保存済みの候補を使い続ける。instructions: 作り直しの指示 (任意)。 */
export const conceptSheetGenerationSchema = z.object({
  id: z.string().uuid(),
  expectedRevision: revision,
  images: z.union([z.literal('keep'), z.array(sceneImage).min(1).max(SCENE_IMAGES_MAX)]),
  instructions: z.string().trim().max(INSTRUCTIONS_MAX).default(''),
}).strict();

export interface DecodedSceneImage { image: ConceptSheetImage; bytes: Uint8Array }

/** data URL を検証して画像の実体に戻す。形式・種類・大きさが合わなければ 400 / 413。 */
export function decodeSceneImage(label: string, dataUrl: string): DecodedSceneImage {
  const match = DATA_URL.exec(dataUrl);
  if (!match) throw AppError.badRequest('invalid_scene_image');
  const mimeType = match[1] as SceneImageType;
  if (!SCENE_IMAGE_TYPES.includes(mimeType)) throw AppError.badRequest('invalid_scene_image');
  const bytes = new Uint8Array(Buffer.from(match[2]!, 'base64'));
  if (bytes.byteLength === 0) throw AppError.badRequest('invalid_scene_image');
  if (bytes.byteLength > SCENE_IMAGE_MAX_BYTES) throw new AppError('scene_image_too_large', 413);
  if (!matchesSignature(mimeType, bytes)) throw AppError.badRequest('invalid_scene_image');
  const digest = createHash('sha256').update(bytes).digest('hex');
  return { image: { label, dataUrl, mimeType, digest }, bytes };
}

/** 候補全体を検証する。合計の上限も見る。 */
export function decodeSceneImages(images: Array<{ label: string; dataUrl: string }>): DecodedSceneImage[] {
  const decoded = images.map((i) => decodeSceneImage(i.label, i.dataUrl));
  const total = decoded.reduce((sum, d) => sum + d.bytes.byteLength, 0);
  if (total > SCENE_IMAGES_TOTAL_MAX_BYTES) throw new AppError('scene_images_too_large', 413);
  return decoded;
}

export function imagesDigest(images: ConceptSheetImage[]): string {
  return createHash('sha256').update(JSON.stringify(images.map((i) => [i.label, i.digest]))).digest('hex');
}

/** 申告された種類と中身の先頭が一致するか。拡張子や宣言だけを信用しない。 */
function matchesSignature(mimeType: SceneImageType, b: Uint8Array): boolean {
  if (mimeType === 'image/png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (mimeType === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
}
