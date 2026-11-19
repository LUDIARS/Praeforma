// シーンエディタの取り込み資料から遷移図に出すキャプチャを選ぶ (spec/feature/scene-map.md PF-MAP-7)。DB を読まない純関数。
import type { SceneDocument } from '../../../shared/scene-editor.ts';

export interface SceneCapture { contentType: string; body: Uint8Array<ArrayBuffer> }

/** 先頭のフレームに対応する画像を優先し、無ければ最初の画像を返す。 */
export function pickCapture(document: SceneDocument): SceneCapture | null {
  const frameOrder = new Map(document.canvas.frames.map((frame, index) => [frame.id, index]));
  const images = document.sources
    .filter((source) => source.image && frameOrder.has(source.frameId))
    .sort((a, b) => frameOrder.get(a.frameId)! - frameOrder.get(b.frameId)!);
  const image = images[0]?.image;
  const match = image ? /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(image) : null;
  if (!match) return null;
  return { contentType: match[1]!, body: new Uint8Array(Buffer.from(match[2]!, 'base64')) };
}
