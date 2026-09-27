import React from 'react';
import { defaultProjectFilters, parseProjectFilters, PROJECT_FILTER_KEY, serializeProjectFilters, type SavedProjectFilters } from '../../../shared/project-index.ts';
export function useProjectFilters() {
  const [state, setState] = React.useState(() => {
    try { return { filters: parseProjectFilters(localStorage.getItem(PROJECT_FILTER_KEY)), error: '' }; }
    catch { return { filters: defaultProjectFilters(), error: 'このブラウザではフィルタを保存できません。' }; }
  });
  const update = (patch: Partial<SavedProjectFilters>): void => {
    const filters = { ...state.filters, ...patch };
    try { localStorage.setItem(PROJECT_FILTER_KEY, serializeProjectFilters(filters)); setState({ filters, error: '' }); }
    catch { setState({ filters, error: '絞り込みは適用されますが、次回用の保存に失敗しました。' }); }
  };
  return { ...state, update };
}
