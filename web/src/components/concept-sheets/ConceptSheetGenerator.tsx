// 企画概要書を Astra に作らせる (spec/feature/concept-sheet.md PF-CS-1 / PF-CS-2 / PF-CS-9)。
// 画面の候補 (現状のツール UI・ゲーム画面) を 1〜6 枚選び、名前を付ける。Astra が一番いいシーンを選んで紙面に明記する。
// 作り直しでは、保存済みの候補を使い続けられ、指示を添えられる。生成は裏で走るので、受け付けたらすぐ閉じる。
import React from 'react';
import { SCENE_IMAGES_MAX, SCENE_LABEL_MAX, INSTRUCTIONS_MAX, type ConceptSheetImage } from '../../../../shared/concept-sheet.ts';
import { conceptSheetApi, conceptSheetError, type SceneImageInput } from '../../lib/concept-sheets-api.ts';
import { readSceneImage } from '../../lib/read-scene-image.ts';

/** ファイル名から拡張子を外して、名前の初期値にする。 */
const labelOf = (file: File): string => file.name.replace(/\.[^.]+$/, '').slice(0, SCENE_LABEL_MAX);

export function ConceptSheetGenerator({ pid, sheetId, expectedRevision, savedImages, onStarted, onCancel }: {
  pid: string; sheetId: string; expectedRevision: number; savedImages: ConceptSheetImage[];
  onStarted: (id: string) => void; onCancel?: () => void;
}): React.ReactElement {
  const [keep, setKeep] = React.useState(savedImages.length > 0);
  const [images, setImages] = React.useState<SceneImageInput[]>([]);
  const [instructions, setInstructions] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function add(files: FileList | null): Promise<void> {
    if (!files) return;
    const room = SCENE_IMAGES_MAX - images.length;
    const picked = [...files].slice(0, Math.max(0, room));
    const results = await Promise.all(picked.map(async (file) => ({ file, result: await readSceneImage(file) })));
    const errors = results.flatMap(({ result }) => (result.ok ? [] : [result.message]));
    const added = results.flatMap(({ file, result }) => (result.ok ? [{ label: labelOf(file), dataUrl: result.dataUrl }] : []));
    setImages((current) => [...current, ...added]);
    if (files.length > picked.length) errors.push(`画面は ${SCENE_IMAGES_MAX} 枚までです。`);
    setMessage(errors.length ? errors.join(' ') : null);
  }

  async function generate(): Promise<void> {
    if (!keep && images.length === 0) { setMessage('画面の画像を 1 枚以上選んでください。'); return; }
    if (!keep && images.some((i) => !i.label.trim())) { setMessage('すべての画面に名前を付けてください。'); return; }
    setBusy(true); setMessage(null);
    try {
      const result = await conceptSheetApi.generate(pid, {
        id: sheetId, expectedRevision, images: keep ? 'keep' : images.map((i) => ({ ...i, label: i.label.trim() })), instructions,
      });
      onStarted(result.id);
    } catch (error) { setMessage(conceptSheetError(error)); }
    finally { setBusy(false); }
  }

  return <section className="concept-sheet-generator" aria-label="企画概要書を作る">
    <p>UX（目指す価値/コンセプト・ターゲットユーザー・カスタマージャーニー・企画の制約・詳細）と画面の候補から、
      デザインされた 1 枚の企画概要書を AI (Astra) が作ります。一番伝わる画面を AI が選び、紙面にシーン名を書きます。
      キャッチコピーは UX の「目指す価値/コンセプト」の文言をそのまま載せます（空なら AI が案を作り、UX にも「AI案」として入れます）。
      作成には数分〜十数分かかります。その間、ほかの画面を使えます。</p>
    <fieldset className="concept-sheet-visual-choice" disabled={busy}>
      <legend>画面の候補（現状のツール画面・ゲーム画面、{SCENE_IMAGES_MAX} 枚まで）</legend>
      {savedImages.length > 0 && <>
        <label><input type="radio" name="scene-images" checked={keep} onChange={() => setKeep(true)} />
          前回の候補を使う（{savedImages.map((i) => i.label).join('、')}）</label>
        <label><input type="radio" name="scene-images" checked={!keep} onChange={() => setKeep(false)} /> 選び直す</label>
      </>}
      {!keep && <div className="concept-sheet-visual-pick">
        <input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={images.length >= SCENE_IMAGES_MAX}
          onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
        <ul className="concept-sheet-scenes">
          {images.map((image, index) => <li key={image.dataUrl.slice(-48) + index}>
            <img src={image.dataUrl} alt={`候補 ${index + 1}`} />
            <label>画面の名前
              <input type="text" value={image.label} maxLength={SCENE_LABEL_MAX}
                onChange={(e) => setImages(images.map((it, i) => (i === index ? { ...it, label: e.target.value } : it)))} />
            </label>
            <button type="button" onClick={() => setImages(images.filter((_, i) => i !== index))}>外す</button>
          </li>)}
        </ul>
        <span className="concept-sheet-hint">PNG / JPEG / WebP、1 枚 4MB・合計 16MB まで。名前は紙面に「現在の画面：名前」として載ります。
          実画面でない図（配置図など）は、名前にそう書いてください。</span>
      </div>}
    </fieldset>
    {expectedRevision > 0 && <label className="concept-sheet-instructions">作り直しの指示（任意）
      <textarea rows={3} maxLength={INSTRUCTIONS_MAX} value={instructions} disabled={busy}
        placeholder="例: 主役の画面を大きく、色は落ち着いたトーンに"
        onChange={(e) => setInstructions(e.target.value)} />
    </label>}
    {message && <p role="alert">{message}</p>}
    <div className="concept-sheet-actions">
      <button className="primary" type="button" disabled={busy} onClick={() => { void generate(); }}>
        {busy ? '受け付け中…' : expectedRevision === 0 ? '企画概要書を作る' : '作り直す'}
      </button>
      {onCancel && <button type="button" disabled={busy} onClick={onCancel}>やめる</button>}
    </div>
  </section>;
}
