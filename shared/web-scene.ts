import { z } from 'zod';

export const webTags = ['div', 'section', 'main', 'header', 'footer', 'nav', 'article', 'aside', 'p', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'button', 'input', 'label', 'strong', 'em', 'br', 'hr', 'text'] as const;
export const cssProperties = ['display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'gap', 'row-gap', 'column-gap', 'flex', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'order', 'color', 'background-color', 'border', 'border-color', 'border-width', 'border-style', 'border-radius', 'font-size', 'font-weight', 'font-family', 'line-height', 'letter-spacing', 'text-align', 'text-decoration', 'white-space', 'overflow', 'overflow-x', 'overflow-y', 'box-sizing', 'box-shadow', 'opacity', 'cursor'] as const;
export const classNameSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_-]*$/).max(100);
const identifier = z.string().min(1).max(120);
const cssValue = z.string().trim().min(1).max(300).refine(value => !/[;{}<>\\@]/.test(value) && !/url\s*\(|expression\s*\(|\/\*/i.test(value), 'unsafe_css_value');
export const webNodeSchema = z.object({
  id: identifier, parentId: identifier.nullable(), tag: z.enum(webTags), text: z.string().max(4000),
  classes: z.array(classNameSchema).max(30),
  attributes: z.object({ title: z.string().max(500).optional(), 'aria-label': z.string().max(500).optional(), placeholder: z.string().max(500).optional(), value: z.string().max(1000).optional(), type: z.enum(['text', 'number', 'checkbox', 'radio', 'button']).optional() }).strict(),
}).strict();
export const webStyleSchema = z.object({
  className: classNameSchema, device: z.enum(['all', 'desktop', 'mobile']),
  declarations: z.record(z.enum(cssProperties), cssValue),
}).strict();
export const webSceneSchema = z.object({
  version: z.literal(1),
  variants: z.array(z.object({ frameId: identifier, nodes: z.array(webNodeSchema).max(500) }).strict()).max(200),
  styles: z.array(webStyleSchema).max(200),
}).strict().superRefine((scene, ctx) => {
  if (new Set(scene.variants.map(v => v.frameId)).size !== scene.variants.length) ctx.addIssue({ code: 'custom', message: 'duplicate_web_frame' });
  const styles = scene.styles.map(style => `${style.device}:${style.className}`);
  if (new Set(styles).size !== styles.length) ctx.addIssue({ code: 'custom', message: 'duplicate_css_class' });
  for (const variant of scene.variants) {
    const nodes = new Map(variant.nodes.map(node => [node.id, node]));
    if (nodes.size !== variant.nodes.length) ctx.addIssue({ code: 'custom', message: 'duplicate_dom_id' });
    for (const node of variant.nodes) {
      const seen = new Set([node.id]); let parent = node.parentId;
      while (parent) {
        const ancestor = nodes.get(parent);
        if (!ancestor || seen.has(parent) || seen.size > 32 || ['input', 'br', 'hr', 'text'].includes(ancestor.tag)) {
          ctx.addIssue({ code: 'custom', message: 'invalid_dom_tree' }); break;
        }
        seen.add(parent); parent = ancestor.parentId;
      }
      if (['input', 'br', 'hr'].includes(node.tag) && node.text) ctx.addIssue({ code: 'custom', message: 'void_element_text' });
      if (node.tag === 'text' && (node.classes.length || Object.keys(node.attributes).length)) ctx.addIssue({ code: 'custom', message: 'text_node_attributes' });
    }
  }
});
export type WebNode = z.infer<typeof webNodeSchema>;
export type WebStyle = z.infer<typeof webStyleSchema>;
export type WebScene = z.infer<typeof webSceneSchema>;
