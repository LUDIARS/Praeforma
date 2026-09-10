import { webSceneSchema, type WebScene, type WebNode } from './web-scene.ts';

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Export only validated inert markup; source node IDs remain editor metadata. */
export function webMarkup(scene: WebScene, frameId: string, preview = false): string {
  const validated = webSceneSchema.parse(scene);
  const nodes = validated.variants.find(variant => variant.frameId === frameId)?.nodes ?? [];
  const render = (node: WebNode): string => {
    if (node.tag === 'text') return preview ? `<span data-pf-node="${escape(node.id)}">${escape(node.text)}</span>` : escape(node.text);
    const attrs = Object.entries(node.attributes).map(([key, value]) => ` ${key}="${escape(value)}"`).join('');
    const classes = node.classes.length ? ` class="${node.classes.join(' ')}"` : '';
    const marker = preview ? ` data-pf-node="${escape(node.id)}"` : '';
    const opening = `<${node.tag}${classes}${attrs}${marker}>`;
    return ['input', 'br', 'hr'].includes(node.tag) ? opening : `${opening}${escape(node.text)}${nodes.filter(child => child.parentId === node.id).map(render).join('')}</${node.tag}>`;
  };
  return nodes.filter(node => node.parentId === null).map(render).join('\n');
}

export function webCss(scene: WebScene): string {
  return webSceneSchema.parse(scene).styles.slice().sort((a, b) => Number(a.device !== 'all') - Number(b.device !== 'all')).map(style => {
    const rule = `.${style.className} {\n${Object.entries(style.declarations).map(([key, value]) => `  ${key}: ${value};`).join('\n')}\n}`;
    return style.device === 'all' ? rule : `@media (${style.device === 'mobile' ? 'max' : 'min'}-width: ${style.device === 'mobile' ? 767 : 768}px) {\n${rule}\n}`;
  }).join('\n\n');
}

export function webPreview(scene: WebScene, frameId: string): string {
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>body { margin: 0; } ${webCss(scene)}</style></head><body>${webMarkup(scene, frameId, true)}</body></html>`;
}

export function sourceDiff(before: string, after: string, filename: string): string {
  if (before === after) return '';
  const oldLines = before ? before.split('\n') : [], newLines = after ? after.split('\n') : [];
  return `--- a/${filename}\n+++ b/${filename}\n@@ -${oldLines.length ? 1 : 0},${oldLines.length} +${newLines.length ? 1 : 0},${newLines.length} @@\n${[...oldLines.map(line => `-${line}`), ...newLines.map(line => `+${line}`)].join('\n')}\n`;
}
