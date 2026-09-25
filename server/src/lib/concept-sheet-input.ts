// 企画概要書 API の入力検証 (spec/feature/concept-sheet.md PF-CS-2 / PF-CS-4)。
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { conceptSheetDocumentSchema, KEY_VISUAL_MAX_BYTES, KEY_VISUAL_TYPES, type ConceptSheetKeyVisual, type KeyVisualType } from '../../../shared/concept-sheet.ts';
import { AppError } from './errors.ts';

const revision = z.number().int().min(0).max(2_147_483_646);
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/;

/** keyVisual: data URL = 新しい画像 / 'keep' = 保存済みの画像を使い続ける / null = 使わない。 */
export const conceptSheetGenerationSchema = z.object({
  id: z.string().uuid(),
  expectedRevision: revision,
  keyVisual: z.union([z.string().max(Math.ceil(KEY_VISUAL_MAX_BYTES * 4 / 3) + 64), z.null()]),
}).strict();

export const conceptSheetSaveSchema = z.object({
  document: conceptSheetDocumentSchema,
  expectedRevision: revision.min(1),
}).strict();

export interface DecodedKeyVisual { visual: ConceptSheetKeyVisual; bytes: Uint8Array }

/** data URL を検証して画像の実体に戻す。形式・種類・大きさが合わなければ 400 / 413。 */
export function decodeKeyVisual(dataUrl: string): DecodedKeyVisual {
  const match = DATA_URL.exec(dataUrl);
  if (!match) throw AppError.badRequest('invalid_key_visual');
  const mimeType = match[1] as KeyVisualType;
  if (!KEY_VISUAL_TYPES.includes(mimeType)) throw AppError.badRequest('invalid_key_visual');
  const bytes = new Uint8Array(Buffer.from(match[2]!, 'base64'));
  if (bytes.byteLength === 0) throw AppError.badRequest('invalid_key_visual');
  if (bytes.byteLength > KEY_VISUAL_MAX_BYTES) throw new AppError('key_visual_too_large', 413);
  if (!matchesSignature(mimeType, bytes)) throw AppError.badRequest('invalid_key_visual');
  const digest = createHash('sha256').update(bytes).digest('hex');
  return { visual: { dataUrl, mimeType, digest }, bytes };
}

/** 申告された種類と中身の先頭が一致するか。拡張子や宣言だけを信用しない。 */
function matchesSignature(mimeType: KeyVisualType, b: Uint8Array): boolean {
  if (mimeType === 'image/png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (mimeType === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
}
