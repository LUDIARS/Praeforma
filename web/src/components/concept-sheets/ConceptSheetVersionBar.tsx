// 版 (rv) の切り替えと、自動更新の ON/OFF (spec/feature/concept-sheet.md PF-CS-10 / PF-CS-11)。
import React from 'react';
import type { ConceptSheetRecord, ConceptSheetVersionKind, ConceptSheetVersionSummary } from '../../../../shared/concept-sheet.ts';

export const VERSION_KIND_LABELS: Record<ConceptSheetVersionKind, string> = {
  create: '作成', regenerate: '作り直し', auto: '自動更新', migrated: '引き継ぎ',
};

export function ConceptSheetVersionBar({ sheet, versions, canEdit, disabled, onSelect, onAutoUpdate }: {
  sheet: ConceptSheetRecord; versions: ConceptSheetVersionSummary[]; canEdit: boolean; disabled?: boolean;
  onSelect: (rv: number) => void; onAutoUpdate: (enabled: boolean) => void;
}): React.ReactElement {
  return <div className="concept-sheet-actions concept-sheet-version-bar">
    <label>版
      <select value={sheet.rv} disabled={disabled} onChange={(e) => onSelect(Number(e.target.value))} style={{ marginLeft: 6 }}>
        {versions.map((v) => <option key={v.rv} value={v.rv}>
          rv{v.rv}（{VERSION_KIND_LABELS[v.kind]}・{v.createdAt.slice(0, 10)}）{v.rv === sheet.latestRv ? '・最新' : ''}
        </option>)}
      </select>
    </label>
    {sheet.rv !== sheet.latestRv && <button type="button" disabled={disabled} onClick={() => onSelect(sheet.latestRv)}>最新版に戻る</button>}
    <label className="concept-sheet-hint">
      <input type="checkbox" checked={sheet.autoUpdate} disabled={!canEdit || disabled}
        onChange={(e) => onAutoUpdate(e.target.checked)} />
      自動更新（UX・企画の制約・仕様・使っているビジュアルが変わったら、落ち着いてから新しい版を作る）
    </label>
  </div>;
}
