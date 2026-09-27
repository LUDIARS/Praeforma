import { node } from './content.mjs';

function framePreview(frame, elements) {
  const article = node('article'); article.append(node('h3', frame.name));
  const preview = node('div'); preview.className = 'elements-preview';
  preview.style.aspectRatio = `${frame.width} / ${frame.height}`;
  preview.setAttribute('aria-label', `${frame.name} の要素配置`);
  elements.forEach(element => {
    const box = node('div', element.label); box.className = 'element-box';
    Object.assign(box.style, { left: `${100 * element.x / frame.width}%`, top: `${100 * element.y / frame.height}%`,
      width: `${100 * element.width / frame.width}%`, height: `${100 * element.height / frame.height}%` });
    preview.append(box);
  });
  article.append(preview);
  const list = node('ul');
  elements.forEach(element => list.append(node('li', `${element.label} (${element.kind})`)));
  article.append(elements.length ? list : node('p', '要素は未登録です。'));
  return article;
}

/** Canvas labels and placements only; specification bodies have their own view. */
export function showElements(container, snapshot, scenario) {
  container.append(node('h3', 'シーンの基本要素'));
  if (!snapshot.scene) container.append(node('p', 'シーンを指定すると基本要素を表示します。'));
  snapshot.scene?.canvas.frames.forEach(frame => container.append(framePreview(frame, snapshot.scene.canvas.elements.filter(item => item.frame_id === frame.id))));
  if (!scenario) { container.append(node('p', 'シナリオを選ぶと追加パーツを表示します。')); return; }
  container.append(node('h3', 'シナリオの追加パーツ'));
  const frames = scenario.canvas.frames.filter(frame => !snapshot.scene || frame.scene_ref?.layout_id === snapshot.scene.id);
  frames.forEach(frame => container.append(framePreview(frame, scenario.canvas.elements.filter(item => item.frame_id === frame.id))));
  if (!frames.length) container.append(node('p', '対象の追加パーツはありません。'));
}
