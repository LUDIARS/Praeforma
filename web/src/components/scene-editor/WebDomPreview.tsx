import React from 'react';
import type { WebScene } from '../../../../shared/web-scene.ts';
import type { WebOffset } from '../../../../shared/web-scene-placement.ts';
import type { WebMoveMode } from '../../../../shared/web-scene-move.ts';
import type { WebRect } from '../../../../shared/web-scene-pointer.ts';
import { webPreview } from '../../../../shared/web-scene-export.ts';
import { nodeRect } from './preview-geometry.ts';
import { useWebPreviewDrag } from './useWebPreviewDrag.ts';
import { WebDomDragOverlay } from './WebDomDragOverlay.tsx';

interface Props {
  scene: WebScene; frameId: string; width: number; height: number; selectedId: string;
  /** null = selection mode (click to select, native scrolling). */
  mode: WebMoveMode | null;
  baseOffset: (nodeId: string) => WebOffset;
  onSelect: (id: string) => void;
  onGroupMove: (nodeId: string, delta: WebOffset) => void;
  onIndividualMove: (nodeId: string, parentId: string | null, beforeId: string | null) => void;
}

export function WebDomPreview({ scene, frameId, width, height, selectedId, mode, baseOffset, onSelect, onGroupMove, onIndividualMove }: Props): React.ReactElement {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const cleanup = React.useRef<(() => void) | null>(null);
  const [layoutVersion, setLayoutVersion] = React.useState(0);
  const [selectedRect, setSelectedRect] = React.useState<WebRect | null>(null);
  React.useEffect(() => () => cleanup.current?.(), []);
  const html = React.useMemo(() => webPreview(scene, frameId), [scene, frameId]);
  const nodes = React.useMemo(() => scene.variants.find(variant => variant.frameId === frameId)?.nodes ?? [], [scene, frameId]);
  const drag = useWebPreviewDrag({ frame, nodes, selectedId, mode, baseOffset, onSelect, onGroupMove, onIndividualMove });
  React.useLayoutEffect(() => {
    const document = frame.current?.contentDocument;
    setSelectedRect(document && selectedId ? nodeRect(document, selectedId) : null);
  }, [selectedId, layoutVersion]);
  return <div style={{ overflow: 'auto', maxHeight: 700, border: '1px solid var(--border)' }}>
    <div className="web-dom-stage" style={{ width, height }}>
      <iframe ref={frame} title="WebUI DOMプレビュー" sandbox="allow-same-origin" srcDoc={html} width={width} height={height} style={{ background: 'white', border: 0 }} onLoad={event => {
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
        // The selection outline lives in the parent overlay, so it is re-measured after reloads and scrolls.
        const relayout = (): void => setLayoutVersion(version => version + 1);
        document.addEventListener('click', click, true);
        document.addEventListener('submit', prevent, true);
        document.addEventListener('keydown', prevent, true);
        document.addEventListener('scroll', relayout, true);
        cleanup.current = () => { document.removeEventListener('click', click, true); document.removeEventListener('submit', prevent, true); document.removeEventListener('keydown', prevent, true); document.removeEventListener('scroll', relayout, true); };
        relayout();
      }} />
      <WebDomDragOverlay isMoving={mode !== null} selectedRect={selectedRect} view={drag.view} handlers={drag.handlers} />
    </div>
  </div>;
}
