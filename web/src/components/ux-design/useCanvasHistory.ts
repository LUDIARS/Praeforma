import React from 'react';
import type { UxCanvasDocument } from '../../lib/ux-design-api.ts';

export interface CanvasHistory {
  canvas: UxCanvasDocument;
  replace: (next: UxCanvasDocument) => void;
  preview: (next: UxCanvasDocument) => void;
  cancelPreview: () => void;
  reset: (next: UxCanvasDocument) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useCanvasHistory(initial: UxCanvasDocument): CanvasHistory {
  const [states, setStates] = React.useState<UxCanvasDocument[]>([initial]);
  const [index, setIndex] = React.useState(0);
  const [preview, setPreview] = React.useState<UxCanvasDocument | null>(null);

  return {
    canvas: preview ?? states[index] ?? initial,
    replace(next) {
      setStates((current) => {
        const updated = [...current.slice(0, index + 1), next];
        return updated.length > 80 ? updated.slice(updated.length - 80) : updated;
      });
      setIndex((current) => Math.min(79, current + 1));
      setPreview(null);
    },
    preview(next) { setPreview(next); },
    cancelPreview() { setPreview(null); },
    reset(next) {
      setStates([next]);
      setIndex(0);
      setPreview(null);
    },
    undo() { setPreview(null); setIndex((current) => Math.max(0, current - 1)); },
    redo() { setPreview(null); setIndex((current) => Math.min(states.length - 1, current + 1)); },
    canUndo: index > 0,
    canRedo: index < states.length - 1,
  };
}
