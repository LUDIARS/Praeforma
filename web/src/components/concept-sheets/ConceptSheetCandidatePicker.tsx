// 企画概要書の画面の候補を、登録したビジュアルから選ぶ (spec/feature/concept-sheet.md PF-CS-12)。最大 6 枚、選んだ順が候補の順。
// ここで新しい画像を足すと、ビジュアルにも登録され、そのまま候補に入る。
import React from 'react';
import { SCENE_IMAGES_MAX } from '../../../../shared/concept-sheet.ts';
import { VISUAL_KIND_LABELS, type ProjectVisual } from '../../../../shared/project-visual.ts';
import { VisualThumb } from '../visuals/VisualThumb.tsx';
import { VisualUploadForm } from '../visuals/VisualUploadForm.tsx';
import '../../styles/project-visuals.css';

export function ConceptSheetCandidatePicker({ pid, visuals, max, selected, onChange, onCreated, disabled }: {
  pid: string; visuals: ProjectVisual[]; max: number; selected: string[]; disabled?: boolean;
  onChange: (ids: string[]) => void; onCreated: (visual: ProjectVisual) => Promise<void>;
}): React.ReactElement {
  const toggle = (id: string): void => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else if (selected.length < SCENE_IMAGES_MAX) onChange([...selected, id]);
  };
  return <div className="concept-sheet-visual-pick">
    {visuals.length === 0 && <p className="concept-sheet-hint">まだビジュアルがありません。下で画像を登録してください。</p>}
    <ul className="concept-sheet-candidates">
      {visuals.map((visual) => {
        const order = selected.indexOf(visual.id);
        return <li key={visual.id} aria-selected={order >= 0}>
          <VisualThumb pid={pid} visual={visual} />
          <label>
            <input type="checkbox" checked={order >= 0} disabled={disabled || (order < 0 && selected.length >= SCENE_IMAGES_MAX)}
              onChange={() => toggle(visual.id)} />
            <span>{order >= 0 && <span className="concept-sheet-candidate-order">{order + 1}. </span>}
              {visual.label}（{VISUAL_KIND_LABELS[visual.kind]}{visual.featured ? '・一押し' : ''}）</span>
          </label>
        </li>;
      })}
    </ul>
    <span className="concept-sheet-hint">{SCENE_IMAGES_MAX} 枚まで（合計 16MB まで）。選んだ順が候補の順です。
      スクリーンショットの名前は紙面に「現在の画面：名前」として載ります。</span>
    <details>
      <summary>新しい画像を足す（ビジュアルにも登録されます）</summary>
      <VisualUploadForm pid={pid} disabled={disabled || visuals.length >= max} onCreated={onCreated} />
    </details>
  </div>;
}
