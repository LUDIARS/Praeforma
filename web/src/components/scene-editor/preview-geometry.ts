import type { WebPoint, WebRect, WebSiblingBox } from '../../../../shared/web-scene-pointer.ts';

/**
 * Read-only geometry of the sandboxed preview document. The parent page reads layout through the
 * same-origin document; nothing here runs inside the iframe (PF-WEB-2).
 */
export function previewDocument(frame: HTMLIFrameElement | null): Document | null {
  return frame?.contentDocument ?? null;
}

export function nodeElement(document: Document, id: string): HTMLElement | null {
  const element = document.querySelector(`[data-pf-node="${CSS.escape(id)}"]`);
  // The element belongs to the iframe's realm, so the parent's HTMLElement constructor cannot test it.
  return element && 'style' in element ? element as HTMLElement : null;
}

export function nodeIdAt(document: Document, point: WebPoint): string | null {
  return document.elementFromPoint(point.x, point.y)?.closest('[data-pf-node]')?.getAttribute('data-pf-node') ?? null;
}

export function nodeRect(document: Document, id: string): WebRect | null {
  const rect = nodeElement(document, id)?.getBoundingClientRect();
  return rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
}

export function siblingBoxes(document: Document, ids: readonly string[]): WebSiblingBox[] {
  return ids.flatMap(id => {
    const rect = nodeRect(document, id);
    return rect ? [{ id, rect }] : [];
  });
}
