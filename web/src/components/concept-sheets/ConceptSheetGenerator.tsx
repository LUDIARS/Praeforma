// 企画概要書を Astra に作らせる (spec/feature/concept-sheet.md PF-CS-1 / PF-CS-9 / PF-CS-12)。
// 画面の候補は登録したビジュアルから 1〜6 枚選ぶ (既定: キービジュアル → 一押し → コンセプトアート)。
// Astra が一番いいシーンを選んで紙面に明記する。作り直しでは前回の候補を使い続けられ、指示を添えられる。
// 生成は裏で走るので、受け付けたらすぐ閉じる。
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { INSTRUCTIONS_MAX, SCENE_IMAGES_MAX } from '../../../../shared/concept-sheet.ts';
import { defaultCandidateVisualIds, type ProjectVisual } from '../../../../shared/project-visual.ts';
import { conceptSheetApi, conceptSheetError } from '../../lib/concept-sheets-api.ts';
import { visualApi } from '../../lib/project-visuals-api.ts';
import { ConceptSheetCandidatePicker } from './ConceptSheetCandidatePicker.tsx';

export function ConceptSheetGenerator({ pid, sheetId, expectedRevision, previousVisualIds, previousLabels, onStarted, onCancel }: {
  pid: string; sheetId: string; expectedRevision: number;
  /** 前回の版が使ったビジュアル (選び直すときの初期値)。 */
  previousVisualIds: string[];
  /** 前回の候補の名前 (「前回の候補を使う」の説明)。作成のときは空。 */
  previousLabels: string[];
  onStarted: (id: string) => void; onCancel?: () => void;
}): React.ReactElement {
  const queryClient = useQueryClient();
  const visualsQ = useQuery({ queryKey: ['project-visuals', pid], queryFn: () => visualApi.list(pid) });
  const [keep, setKeep] = React.useState(previousLabels.length > 0);
  const [selected, setSelected] = React.useState<string[] | null>(null);
  const [instructions, setInstructions] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // 一覧が届いたら 1 回だけ初期の候補を決める: 前回の候補で残っているもの、無ければ既定。
  const visuals = visualsQ.data?.items;
  React.useEffect(() => {
    if (!visuals || selected !== null) return;
    const ids = new Set(visuals.map((v) => v.id));
    const kept = previousVisualIds.filter((id) => ids.has(id));
    setSelected(kept.length > 0 ? kept : defaultCandidateVisualIds(visuals));
  }, [visuals, selected, previousVisualIds]);

  async function created(visual: ProjectVisual): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['project-visuals', pid] });
    setSelected((current) => (current && current.length < SCENE_IMAGES_MAX ? [...current, visual.id] : current));
  }

  async function generate(): Promise<void> {
    const ids = selected ?? [];
    if (!keep && ids.length === 0) { setMessage('候補のビジュアルを 1 枚以上選んでください。'); return; }
    setBusy(true); setMessage(null);
    try {
      const result = await conceptSheetApi.generate(pid, { id: sheetId, expectedRevision, visualIds: keep ? 'keep' : ids, instructions });
      onStarted(result.id);
    } catch (error) { setMessage(conceptSheetError(error)); }
    finally { setBusy(false); }
  }

  return <section className="concept-sheet-generator" aria-label="企画概要書を作る">
    <p>UX（目指す価値/コンセプト・ターゲットユーザー・カスタマージャーニー・企画の制約・詳細）・仕様の見出しと、
      ビジュアルから選んだ候補で、デザインされた 1 枚の企画概要書を AI (Astra) が作ります。一番伝わる画面を AI が選び、紙面にシーン名を書きます。
      キャッチコピーは UX の「目指す価値/コンセプト」の文言をそのまま載せます（空なら AI が案を作り、UX にも「AI案」として入れます）。
      作成には数分〜十数分かかります。その間、ほかの画面を使えます。</p>
    <fieldset className="concept-sheet-visual-choice" disabled={busy}>
      <legend>画面の候補（ビジュアルから {SCENE_IMAGES_MAX} 枚まで）</legend>
      {previousLabels.length > 0 && <>
        <label><input type="radio" name="scene-images" checked={keep} onChange={() => setKeep(true)} />
          前回の候補を使う（{previousLabels.join('、')}）</label>
        <label><input type="radio" name="scene-images" checked={!keep} onChange={() => setKeep(false)} /> ビジュアルから選び直す</label>
      </>}
      {!keep && (visualsQ.isPending ? <p role="status">ビジュアルを読み込み中…</p>
        : !visualsQ.data ? <p role="alert">ビジュアルを取得できませんでした。
          <button type="button" onClick={() => { void visualsQ.refetch(); }}>再取得</button></p>
          : <ConceptSheetCandidatePicker pid={pid} visuals={visualsQ.data.items} max={visualsQ.data.max} selected={selected ?? []}
            onChange={setSelected} onCreated={created} disabled={busy} />)}
    </fieldset>
    {expectedRevision > 0 && <label className="concept-sheet-instructions">作り直しの指示（任意）
      <textarea rows={3} maxLength={INSTRUCTIONS_MAX} value={instructions} disabled={busy}
        placeholder="例: 主役の画面を大きく、色は落ち着いたトーンに"
        onChange={(e) => setInstructions(e.target.value)} />
    </label>}
    {message && <p role="alert">{message}</p>}
    <div className="concept-sheet-actions">
      <button className="primary" type="button" disabled={busy} onClick={() => { void generate(); }}>
        {busy ? '受け付け中…' : expectedRevision === 0 ? '企画概要書を作る' : '作り直す（新しい版になります）'}
      </button>
      {onCancel && <button type="button" disabled={busy} onClick={onCancel}>やめる</button>}
    </div>
  </section>;
}
