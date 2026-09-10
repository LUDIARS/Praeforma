import { webSceneSchema, webTags, type WebNode } from '../../../../shared/web-scene.ts';

/** Detached parsing does not execute imported markup. Reject unsupported syntax explicitly. */
export function importMarkup(html: string, makeId: () => string): WebNode[] {
  if (html.length > 200000) throw new Error('HTMLは200KB以内で指定してください。');
  // Reject resource-bearing tags before DOMParser can create them, even in its detached document.
  for (const match of html.matchAll(/<\s*\/?\s*([a-zA-Z][^\s/>]*)/g)) {
    if (!(webTags as readonly string[]).includes((match[1] ?? '').toLowerCase()) || match[1]?.toLowerCase() === 'text') throw new Error('未対応のHTMLタグです。画像・埋め込み・スクリプト・外部参照は取り込めません。');
  }
  if (/\b(?:src|srcset|href|style|on\w+)\s*=/i.test(html)) throw new Error('外部参照・style・イベント属性は取り込めません。');
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (document.head.children.length) throw new Error('HTML本文のみを指定してください。styleやscriptは取り込めません。');
  const nodes: WebNode[] = [];
  const visit = (node: Node, parentId: string | null, depth: number): void => {
    if (depth > 32 || nodes.length >= 500) throw new Error('DOMは500ノード、深さ32以内で指定してください。');
    if (node.nodeType === Node.COMMENT_NODE) return;
    const id = makeId();
    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push({ id, parentId, tag: 'text', text: node.textContent ?? '', classes: [], attributes: {} }); return;
    }
    if (!(node instanceof Element)) throw new Error('未対応のHTMLノードです。');
    const attributes: Record<string, string> = {};
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name !== 'class') attributes[attribute.name] = attribute.value;
    }
    nodes.push({ id, parentId, tag: node.tagName.toLowerCase() as WebNode['tag'], text: '', classes: Array.from(node.classList), attributes });
    for (const child of Array.from(node.childNodes)) visit(child, id, depth + 1);
  };
  for (const node of Array.from(document.body.childNodes)) visit(node, null, 0);
  const result = webSceneSchema.safeParse({ version: 1, variants: [{ frameId: 'import', nodes }], styles: [] });
  if (!result.success) throw new Error('未対応のタグ・属性・クラス名、または深すぎるDOMがあります。イベント属性・URL・scriptは使用できません。');
  return result.data.variants[0]?.nodes ?? [];
}
