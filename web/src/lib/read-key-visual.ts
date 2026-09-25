// 選んだ画像ファイルを、送る前に種類と大きさで確かめて data URL にする (PF-CS-2)。
// サーバでも同じ確認をする。ここでの確認は、送る前に理由を伝えるためのもの。
import { KEY_VISUAL_MAX_BYTES, KEY_VISUAL_TYPES } from '../../../shared/concept-sheet.ts';

export type KeyVisualReadResult = { ok: true; dataUrl: string } | { ok: false; message: string };

export function readKeyVisual(file: File): Promise<KeyVisualReadResult> {
  if (!(KEY_VISUAL_TYPES as readonly string[]).includes(file.type)) {
    return Promise.resolve({ ok: false, message: 'PNG / JPEG / WebP の画像を選んでください。' });
  }
  if (file.size > KEY_VISUAL_MAX_BYTES) {
    return Promise.resolve({ ok: false, message: '4MB 以下の画像を選んでください。' });
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string'
      ? { ok: true, dataUrl: reader.result }
      : { ok: false, message: '画像を読み込めませんでした。' });
    reader.onerror = () => resolve({ ok: false, message: '画像を読み込めませんでした。' });
    reader.readAsDataURL(file);
  });
}
