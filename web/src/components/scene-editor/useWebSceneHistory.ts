import React from 'react';
import type { WebScene } from '../../../../shared/web-scene.ts';

export const emptyWebScene: WebScene = { version: 1, variants: [], styles: [] };
export function useWebSceneHistory(initial: WebScene | undefined): {
  value: WebScene; change: (value: WebScene) => void; reset: (value: WebScene) => void;
  undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean;
} {
  const [history, setHistory] = React.useState({ values: [initial ?? emptyWebScene], index: 0 });
  return {
    value: history.values[history.index] ?? emptyWebScene,
    change: value => setHistory(current => {
      const values = [...current.values.slice(0, current.index + 1), value].slice(-60);
      return { values, index: values.length - 1 };
    }),
    reset: value => setHistory({ values: [value], index: 0 }),
    undo: () => setHistory(current => ({ ...current, index: Math.max(0, current.index - 1) })),
    redo: () => setHistory(current => ({ ...current, index: Math.min(current.values.length - 1, current.index + 1) })),
    canUndo: history.index > 0, canRedo: history.index < history.values.length - 1,
  };
}
