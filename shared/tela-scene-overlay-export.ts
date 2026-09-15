import type { DesignCanvasDocument } from './design-canvas.ts';
import { fitFrame } from './scene-layers.ts';

type Frame = DesignCanvasDocument['frames'][number];
type Element = DesignCanvasDocument['elements'][number];

/** Mirrors the Tela scene overlay loader. Exports over these limits fail instead of truncating. */
export const TELA_OVERLAY_MAX_SCENES = 32;
export const TELA_OVERLAY_MAX_ELEMENTS = 1024;
const MINIMUM_EXPORTED_SIZE = 0.01;

export interface TelaOverlayScene { id: string; name: string; visible: boolean; frame: Frame; elements: readonly Element[] }

/** Tela reads fields with std::quoted: backslash escapes quote and backslash, one record per LF line. */
function field(value: string): string {
  return `"${value.replace(/[\r\n\t]+/g, ' ').replace(/[\\"]/g, match => `\\${match}`)}"`;
}
const coordinate = (value: number): string => String(Math.round(value * 100) / 100);
const size = (value: number): string => coordinate(Math.max(MINIMUM_EXPORTED_SIZE, value));

/**
 * Serializes one base frame and its layers as `TELA_SCENE_OVERLAY 1`.
 * Layer elements are mapped into base frame coordinates here, so Tela fits only the base frame
 * into its viewport. The visible flag is the initial state of Tela's per-scene toggle.
 */
export function telaSceneOverlay(base: TelaOverlayScene, layers: readonly TelaOverlayScene[]): string {
  const scenes = [base, ...layers];
  if (scenes.length > TELA_OVERLAY_MAX_SCENES) throw new Error(`Tela へ書き出せるシーンは${TELA_OVERLAY_MAX_SCENES}件までです。`);
  const elementCount = scenes.reduce((sum, scene) => sum + scene.elements.length, 0);
  if (elementCount > TELA_OVERLAY_MAX_ELEMENTS) throw new Error(`Tela へ書き出せる要素は${TELA_OVERLAY_MAX_ELEMENTS}件までです（現在${elementCount}件）。`);
  const lines = ['TELA_SCENE_OVERLAY 1', `frame ${field(base.frame.name)} ${size(base.frame.width)} ${size(base.frame.height)}`];
  for (const scene of scenes) lines.push(`scene ${field(scene.id)} ${field(scene.name)} ${scene.visible ? 1 : 0}`);
  for (const scene of scenes) {
    const fit = scene === base ? { scale: 1, offsetX: 0, offsetY: 0 } : fitFrame(scene.frame, base.frame);
    for (const element of scene.elements) {
      lines.push([
        'element', field(scene.id), field(element.id), field(element.kind), field(element.label),
        coordinate(fit.offsetX + element.x * fit.scale), coordinate(fit.offsetY + element.y * fit.scale),
        size(element.width * fit.scale), size(element.height * fit.scale),
      ].join(' '));
    }
  }
  return `${lines.join('\n')}\n`;
}
