// 企画概要書の文面を人が直す (spec/feature/concept-sheet.md PF-CS-4)。
// 保存前に共有の文書規則で確かめ、失敗しても入力を消さない。
import React from 'react';
import { conceptSheetDocumentSchema, CONCEPT_SHEET_LIMITS as L, type ConceptSheetDocument } from '../../../../shared/concept-sheet.ts';

type Pair<K extends string> = Record<K, string>;

function Counter({ value, max }: { value: string; max: number }): React.ReactElement {
  return <span className={`concept-sheet-count${value.length > max ? ' over' : ''}`}>{value.length}/{max}</span>;
}

function TextField({ label, value, max, multiline, onChange }: {
  label: string; value: string; max: number; multiline?: boolean; onChange: (v: string) => void;
}): React.ReactElement {
  return <label className="concept-sheet-field">
    <span>{label} <Counter value={value} max={max} /></span>
    {multiline
      ? <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      : <input value={value} onChange={(e) => onChange(e.target.value)} />}
  </label>;
}

/** 見出し + 説明の組 (ここが刺さる / 体験のストーリー) を、上限の範囲で増減しながら直す。 */
function PairList<K extends string>({ legend, items, keys, labels, limits, min, max, onChange }: {
  legend: string; items: Array<Pair<K>>; keys: [K, K]; labels: [string, string]; limits: [number, number];
  min: number; max: number; onChange: (items: Array<Pair<K>>) => void;
}): React.ReactElement {
  const set = (i: number, key: K, v: string): void => onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  return <fieldset className="concept-sheet-list">
    <legend>{legend}（{min}〜{max} 件）</legend>
    {items.map((it, i) => <div key={i} className="concept-sheet-pair">
      <TextField label={`${labels[0]} ${i + 1}`} value={it[keys[0]]} max={limits[0]} onChange={(v) => set(i, keys[0], v)} />
      <TextField label={labels[1]} value={it[keys[1]]} max={limits[1]} multiline onChange={(v) => set(i, keys[1], v)} />
      <button type="button" disabled={items.length <= min} onClick={() => onChange(items.filter((_, j) => j !== i))}>この項目を消す</button>
    </div>)}
    <button type="button" disabled={items.length >= max}
      onClick={() => onChange([...items, { [keys[0]]: '', [keys[1]]: '' } as Pair<K>])}>項目を足す</button>
  </fieldset>;
}

export function ConceptSheetEditor({ initial, saving, onSave, onCancel }: {
  initial: ConceptSheetDocument; saving: boolean;
  onSave: (document: ConceptSheetDocument) => Promise<void>; onCancel: () => void;
}): React.ReactElement {
  const [draft, setDraft] = React.useState(initial);
  const [emotionText, setEmotionText] = React.useState(initial.emotions.join('、'));
  const [issues, setIssues] = React.useState<string[]>([]);
  const update = <K extends keyof ConceptSheetDocument>(key: K, value: ConceptSheetDocument[K]): void => setDraft({ ...draft, [key]: value });

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const emotions = emotionText.split(/[、,\n]/).map((s) => s.trim()).filter(Boolean);
    const parsed = conceptSheetDocumentSchema.safeParse({ ...draft, emotions });
    if (!parsed.success) {
      setIssues(['空欄、文字数の上限、件数、< > の記号を確認してください。']);
      return;
    }
    setIssues([]);
    await onSave(parsed.data);
  }

  return <form className="concept-sheet-editor" onSubmit={(e) => { void submit(e); }}>
    <TextField label="企画名" value={draft.title} max={L.title} onChange={(v) => update('title', v)} />
    <TextField label="キャッチコピー" value={draft.catchcopy} max={L.catchcopy} onChange={(v) => update('catchcopy', v)} />
    <TextField label="ひとことで" value={draft.lead} max={L.lead} multiline onChange={(v) => update('lead', v)} />
    <TextField label="だれに" value={draft.target} max={L.target} multiline onChange={(v) => update('target', v)} />
    <PairList legend="ここが刺さる" items={draft.hooks} keys={['heading', 'text']} labels={['見出し', '説明']}
      limits={[L.hookHeading, L.hookText]} min={L.hooksMin} max={L.hooksMax} onChange={(v) => update('hooks', v)} />
    <PairList legend="体験のストーリー" items={draft.journey} keys={['scene', 'text']} labels={['場面', '説明']}
      limits={[L.journeyScene, L.journeyText]} min={L.journeyMin} max={L.journeyMax} onChange={(v) => update('journey', v)} />
    <label className="concept-sheet-field">
      <span>かかわる感情（「、」区切りで {L.emotionsMin}〜{L.emotionsMax} 個、各 {L.emotion} 字まで）</span>
      <input value={emotionText} onChange={(e) => setEmotionText(e.target.value)} />
    </label>
    <TextField label="目指す状態" value={draft.goal} max={L.goal} multiline onChange={(v) => update('goal', v)} />
    <TextField label="キービジュアルの説明（無ければ空欄）" value={draft.visualCaption} max={L.visualCaption}
      onChange={(v) => update('visualCaption', v)} />
    {issues.map((m) => <p key={m} role="alert">{m}</p>)}
    <div className="concept-sheet-actions">
      <button className="primary" type="submit" disabled={saving}>{saving ? '保存中…' : '修正を保存'}</button>
      <button type="button" disabled={saving} onClick={onCancel}>やめる</button>
    </div>
  </form>;
}
