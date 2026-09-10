import React from 'react';
import type { WebScene } from '../../../../shared/web-scene.ts';
import { webPreview } from '../../../../shared/web-scene-export.ts';

export function WebDomPreview({ scene, frameId, width, height, onSelect }: { scene: WebScene; frameId: string; width: number; height: number; onSelect: (id: string) => void }): React.ReactElement {
  const cleanup = React.useRef<(() => void) | null>(null);
  React.useEffect(() => () => cleanup.current?.(), []);
  const html = React.useMemo(() => webPreview(scene, frameId), [scene, frameId]);
  return <div style={{ overflow: 'auto', maxHeight: 700, border: '1px solid var(--border)' }}>
    <iframe title="WebUI DOMプレビュー" sandbox="allow-same-origin" srcDoc={html} width={width} height={height} style={{ background: 'white', border: 0 }} onLoad={event => {
      cleanup.current?.();
      const document = event.currentTarget.contentDocument;
      if (!document) return;
      const click = (e: MouseEvent): void => {
        e.preventDefault(); e.stopPropagation();
        const target = e.target as Element | null;
        const id = target?.closest?.('[data-pf-node]')?.getAttribute('data-pf-node');
        if (id) onSelect(id);
      };
      const prevent = (e: Event): void => e.preventDefault();
      document.addEventListener('click', click, true);
      document.addEventListener('submit', prevent, true);
      document.addEventListener('keydown', prevent, true);
      cleanup.current = () => { document.removeEventListener('click', click, true); document.removeEventListener('submit', prevent, true); document.removeEventListener('keydown', prevent, true); };
    }} />
  </div>;
}
