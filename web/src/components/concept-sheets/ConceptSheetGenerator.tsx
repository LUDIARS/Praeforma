// UX/ゴールとキービジュアルから企画概要書を作る (spec/feature/concept-sheet.md PF-CS-1 / PF-CS-2)。
// 新規作成と、既存シートの作り直しの両方に使う。生成は数十秒かかるので、その間は操作を止める。
import React from 'react';
import { conceptSheetApi, conceptSheetError } from '../../lib/concept-sheets-api.ts';
import { readKeyVisual } from '../../lib/read-key-visual.ts';

type VisualChoice = 'keep' | 'new' | 'none';

export function ConceptSheetGenerator({ pid, sheetId, expectedRevision, hasSavedVisual, onGenerated, onCancel }: {
  pid: string; sheetId: string; expectedRevision: number; hasSavedVisual: boolean;
  onGenerated: (id: string) => void; onCancel?: () => void;
}): React.ReactElement {
  const [choice, setChoice] = React.useState<VisualChoice>(hasSavedVisual ? 'keep' : 'new');
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function pick(file: File | undefined): Promise<void> {
    if (!file) return;
    const result = await readKeyVisual(file);
    if (result.ok) { setDataUrl(result.dataUrl); setMessage(null); } else { setDataUrl(null); setMessage(result.message); }
  }

  async function generate(): Promise<void> {
    if (choice === 'new' && !dataUrl) { setMessage('キービジュアルの画像を選ぶか、「使わない」を選んでください。'); return; }
    setBusy(true); setMessage(null);
    try {
      const keyVisual = choice === 'keep' ? 'keep' : choice === 'new' ? dataUrl : null;
      const result = await conceptSheetApi.generate(pid, { id: sheetId, expectedRevision, keyVisual });
      onGenerated(result.id);
    } catch (error) { setMessage(conceptSheetError(error)); }
    finally { setBusy(false); }
  }

  return <section className="concept-sheet-generator" aria-label="企画概要書を作る">
    <p>UX/ゴール（目指す体験・ストーリー・かかわる感情・体験の設計・ゴール）とキービジュアルから、1 枚の企画概要書を AI が作ります。
      できた文はあとから直せます。UX/ゴールに書かれていないことは足しません。</p>
    <fieldset className="concept-sheet-visual-choice" disabled={busy}>
      <legend>キービジュアル</legend>
      {hasSavedVisual && <label><input type="radio" name="kv" checked={choice === 'keep'} onChange={() => setChoice('keep')} /> 今の画像を使う</label>}
      <label><input type="radio" name="kv" checked={choice === 'new'} onChange={() => setChoice('new')} /> 画像を選ぶ（PNG / JPEG / WebP、4MB まで）</label>
      <label><input type="radio" name="kv" checked={choice === 'none'} onChange={() => setChoice('none')} /> 使わない</label>
      {choice === 'new' && <div className="concept-sheet-visual-pick">
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { void pick(e.target.files?.[0]); }} />
        {dataUrl && <img src={dataUrl} alt="選んだキービジュアル" />}
      </div>}
    </fieldset>
    {message && <p role="alert">{message}</p>}
    <div className="concept-sheet-actions">
      <button className="primary" type="button" disabled={busy} onClick={() => { void generate(); }}>
        {busy ? '作成中…（数十秒かかります）' : expectedRevision === 0 ? '企画概要書を作る' : '作り直す'}
      </button>
      {onCancel && <button type="button" disabled={busy} onClick={onCancel}>やめる</button>}
      {expectedRevision > 0 && <span className="concept-sheet-hint">作り直すと、人が直した文面も新しい文で置き換わります。</span>}
    </div>
  </section>;
}
