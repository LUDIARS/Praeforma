// 選んだ画面の画像を、送る前に種類と大きさで確かめて data URL にする (PF-CS-2)。
// サーバでも同じ確認をする。ここでの確認は、送る前に理由を伝えるためのもの。
import { SCENE_IMAGE_MAX_BYTES, SCENE_IMAGE_TYPES } from '../../../shared/concept-sheet.ts';

export type SceneImageReadResult = { ok: true; dataUrl: string } | { ok: false; message: string };

export function readSceneImage(file: File): Promise<SceneImageReadResult> {
  if (!(SCENE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return Promise.resolve({ ok: false, message: `${file.name}: PNG / JPEG / WebP の画像を選んでください。` });
  }
  if (file.size > SCENE_IMAGE_MAX_BYTES) {
    return Promise.resolve({ ok: false, message: `${file.name}: 4MB 以下の画像を選んでください。` });
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string'
      ? { ok: true, dataUrl: reader.result }
      : { ok: false, message: `${file.name}: 画像を読み込めませんでした。` });
    reader.onerror = () => resolve({ ok: false, message: `${file.name}: 画像を読み込めませんでした。` });
    reader.readAsDataURL(file);
  });
}
