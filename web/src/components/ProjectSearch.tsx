import React from 'react';
import type { SavedProjectFilters } from '../../../shared/project-index.ts';
export function ProjectSearch({ filters, teams, error, onChange }: {
  filters: SavedProjectFilters; teams: string[]; error: string; onChange: (patch: Partial<SavedProjectFilters>) => void;
}): React.ReactElement {
  const choices = filters.team && !teams.includes(filters.team) ? [filters.team, ...teams] : teams;
  return <section className="panel foundation-form" aria-label="プロジェクト検索">
    <h2>プロジェクトを探す</h2>
    <label className="simple-field"><span>検索</span><input type="search" maxLength={200} placeholder="プロジェクト名・説明・チーム" value={filters.query} onChange={event => onChange({ query: event.target.value })} /></label>
    <label className="simple-field"><span>チーム</span><select value={filters.team} onChange={event => onChange({ team: event.target.value })}><option value="">すべてのチーム</option>{choices.map(team => <option key={team} value={team}>{team === 'local' ? '個人用 (local)' : team}</option>)}</select></label>
    <button className="ghost" type="button" onClick={() => onChange({ query: '', team: '' })}>絞り込みを解除</button>
    <details><summary>設定</summary><label className="check-row"><input type="checkbox" checked={filters.remember} onChange={event => onChange({ remember: event.target.checked })} />検索・チームの絞り込みを次回も使う</label><p>オフにすると保存済みの絞り込みを消し、次回はすべてのプロジェクトを表示します。</p></details>
    {error ? <p role="status">{error}</p> : null}
  </section>;
}
