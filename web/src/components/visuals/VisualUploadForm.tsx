// ビジュアルを 1 枚登録する (PF-VIS-1 / PF-VIS-2)。ビジュアルタブと、企画概要書の作成画面の「新しい画像を足す」で使う。
// 送る前に種類と大きさを確かめる (サーバでも同じ確認をする)。失敗しても選んだ画像と入力は残す。
import React from 'react';
import { VISUAL_IMAGE_TYPES, VISUAL_LIMITS as L, type ProjectVisual, type VisualKind } from '../../../../shared/project-visual.ts';
import { visualApi, visualError, type VisualFieldsInput } from '../../lib/project-visuals-api.ts';
import { readSceneImage } from '../../lib/read-scene-image.ts';
import { VisualFields } from './VisualFields.tsx';

/** ファイル名から拡張子を外して、名前の初期値にする。 */
const labelOf = (file: File): string => file.name.replace(/\.[^.]+$/, '').slice(0, L.label);

export function VisualUploadForm({ pid, defaultKind = 'screenshot', disabled, onCreated }: {
  pid: string; defaultKind?: VisualKind; disabled?: boolean; onCreated: (visual: ProjectVisual) => void | Promise<void>;
}): React.ReactElement {
  const empty: VisualFieldsInput = { kind: defaultKind, label: '', note: '', featured: false };
  const [fields, setFields] = React.useState<VisualFieldsInput>(empty);
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function pick(file: File | undefined): Promise<void> {
    if (!file) return;
    const result = await readSceneImage(file);
    if (!result.ok) { setMessage(result.message); return; }
    setDataUrl(result.dataUrl); setMessage(null);
    setFields((current) => ({ ...current, label: current.label || labelOf(file) }));
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!dataUrl) { setMessage('画像を選んでください。'); return; }
    if (!fields.label.trim()) { setMessage('名前を付けてください。'); return; }
    setBusy(true); setMessage(null);
    try {
      const { visual } = await visualApi.create(pid, { ...fields, label: fields.label.trim(), note: fields.note.trim(), dataUrl });
      setFields(empty); setDataUrl(null);
      await onCreated(visual);
    } catch (error) { setMessage(visualError(error)); }
    finally { setBusy(false); }
  }

  const off = busy || disabled;
  return <form className="project-visual-upload" onSubmit={(e) => { void submit(e); }}>
    <label>画像（PNG / JPEG / WebP、1 枚 4MB まで）
      <input type="file" accept={VISUAL_IMAGE_TYPES.join(',')} disabled={off}
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
    {dataUrl && <img className="project-visual-thumb" src={dataUrl} alt="登録する画像" />}
    <VisualFields value={fields} onChange={setFields} disabled={off} />
    {disabled && <p className="project-visual-hint">ビジュアルは 1 プロジェクト {L.perProject} 枚までです。</p>}
    {message && <p role="alert" className="project-visual-error">{message}</p>}
    <div className="project-visual-actions">
      <button className="primary" type="submit" disabled={off}>{busy ? '登録中…' : '登録する'}</button>
    </div>
  </form>;
}
