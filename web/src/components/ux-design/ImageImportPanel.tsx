import React from 'react';
import type { ImageLayoutAnalysis } from '../../lib/ux-design-api.ts';

interface Props {
  result: ImageLayoutAnalysis | null;
  isAnalyzing: boolean;
  isApplying: boolean;
  isDisabled: boolean;
  onAnalyze: (file: File) => void;
  onApply: (candidateIds: string[]) => void;
}

export function ImageImportPanel({ result, isAnalyzing, isApplying, isDisabled, onAnalyze, onApply }: Props): React.ReactElement {
  const [selected, setSelected] = React.useState<string[]>([]);
  React.useEffect(() => { setSelected(result?.candidates.map((candidate) => candidate.id) ?? []); }, [result]);

  return (
    <section className="ux-import-panel">
      <h3>画像からレイアウト案を作る</h3>
      <p>解析結果は候補として表示します。選んだ候補だけを現在の編集へ追加します。</p>
      <label className="ux-file-button">
        {isAnalyzing ? '解析中…' : isDisabled ? '先にキャンバスを保存' : '画像を選択'}
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={isAnalyzing || isDisabled} onChange={(event) => { const file = event.target.files?.[0]; if (file) onAnalyze(file); event.target.value = ''; }} />
      </label>
      {result ? <div className="ux-image-candidates">{result.candidates.map((candidate) => (
        <label key={candidate.id} className="ux-image-candidate">
          <input type="checkbox" checked={selected.includes(candidate.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id))} />
          <span><strong>{candidate.label}</strong><small>{Math.round(candidate.confidence * 100)}% / 要素 {candidate.elements.length}</small>{candidate.notes.map((note) => <em key={note}>{note}</em>)}</span>
        </label>
      ))}<button className="primary" type="button" disabled={isApplying || selected.length === 0} onClick={() => onApply(selected)}>{isApplying ? '反映中…' : '選択した案を追加'}</button></div> : null}
    </section>
  );
}
