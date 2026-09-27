import type { ReviewOverlaySnapshot } from './review-overlay.ts';
import { telaSceneOverlay, type TelaOverlayScene } from './tela-scene-overlay-export.ts';
import { fitFrame } from './scene-layers.ts';
import { reviewSections, type ReviewSection } from './review-overlay-sections.ts';
type Element = TelaOverlayScene['elements'][number];

/** Metadata is carried as UTF-8 text records. The companion displays it separately from placements. */
function sectionElements(sections: ReviewSection[], frame: TelaOverlayScene['frame']): Element[] {
  const element = (id: string, label: string): Element => ({ id, label, frame_id: frame.id, kind: 'text',
    x: 0, y: 0, width: 1, height: 1, sample_text: null, dynamic: null, follow: null });
  return sections.flatMap(section => {
    const key = section.mode + '/' + encodeURIComponent(section.id);
    let index = 0;
    return [element('pf-review-heading/' + key, section.title), ...section.body.split(/\r?\n/).flatMap(line => {
      const points = Array.from(line || ' ');
      // 1000 Unicode code points fit within Tela's 4096-byte label limit, including 4-byte characters.
      return Array.from({ length: Math.ceil(points.length / 1000) }, (_, page) =>
        element('pf-review-body/' + key + '/' + index++, points.slice(page * 1000, (page + 1) * 1000).join('')));
    })];
  });
}
export function reviewOverlayTela(snapshot: ReviewOverlaySnapshot, frameId?: string): string {
  const original = frameId ? snapshot.scene?.canvas.frames.find(frame => frame.id === frameId) : snapshot.scene?.canvas.frames[0];
  if (frameId && !original) throw new Error('指定したシーン画面がありません。');
  const frame = original ?? { id: 'review', name: snapshot.projectName, width: 1280, height: 720, x: 0, y: 0, viewport: { width: 1280, height: 720 }, description: '', states: [] };
  const base: TelaOverlayScene = { id: 'base', name: 'シーンの基本要素', visible: true, frame,
    elements: original ? (snapshot.scene?.canvas.elements ?? []).filter(element => element.frame_id === original.id) : [] };
  const layers: TelaOverlayScene[] = [{ id: 'review-project', name: 'シナリオなし', visible: true, frame, elements: sectionElements(reviewSections(snapshot), frame) }];
  snapshot.scenarios.forEach(scenario => {
    const frames = scenario.canvas.frames.filter(item => !original || (item.scene_ref?.layout_id === snapshot.scene?.id && item.scene_ref?.frame_id === original.id));
    const parts = frames.flatMap(item => {
      const fit = fitFrame(item, frame);
      return scenario.canvas.elements.filter(element => element.frame_id === item.id).map(element => ({ ...element,
        id: item.id + '-' + element.id, x: fit.offsetX + element.x * fit.scale, y: fit.offsetY + element.y * fit.scale,
        width: element.width * fit.scale, height: element.height * fit.scale }));
    });
    layers.push({ id: 'scenario-' + scenario.id, name: scenario.name, visible: false, frame,
      elements: [...parts, ...sectionElements(reviewSections(snapshot, scenario), frame)] });
  });
  return telaSceneOverlay(base, layers);
}
