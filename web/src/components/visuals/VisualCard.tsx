// ビジュアル 1 枚: 表示・名前やメモの直し・一押しの切り替え・削除 (PF-VIS-1 / PF-VIS-3 / PF-VIS-4)。
import React from 'react';
import { VISUAL_KIND_LABELS, type ProjectVisual } from '../../../../shared/project-visual.ts';
import { visualApi, visualError, type VisualFieldsInput } from '../../lib/project-visuals-api.ts';
import { VisualFields } from './VisualFields.tsx';
import { VisualThumb } from './VisualThumb.tsx';

const fieldsOf = (v: ProjectVisual): VisualFieldsInput => ({ kind: v.kind, label: v.label, note: v.note, featured: v.featured });

export function VisualCard({ pid, visual, canEdit, onChanged }: {
  pid: string; visual: ProjectVisual; canEdit: boolean; onChanged: () => Promise<void>;
}): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<VisualFieldsInput>(() => fieldsOf(visual));
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function run(work: () => Promise<unknown>): Promise<boolean> {
    setBusy(true); setError(null);
    try { await work(); await onChanged(); return true; }
    catch (e) { setError(visualError(e)); return false; }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!draft.label.trim()) { setError('名前を付けてください。'); return; }
    const input = { ...draft, label: draft.label.trim(), note: draft.note.trim() };
    if (await run(() => visualApi.update(pid, visual.id, input, visual.revision))) setEditing(false);
  }
  async function toggleFeatured(): Promise<void> {
    await run(() => visualApi.update(pid, visual.id, { ...fieldsOf(visual), featured: !visual.featured }, visual.revision));
  }
  async function remove(): Promise<void> {
    if (!window.confirm(`ビジュアル「${visual.label}」を削除しますか？ 企画概要書の過去の版で使った画像は、その版の表示のために残ります。`)) return;
    await run(() => visualApi.remove(pid, visual.id, visual.revision));
  }

  return <article className="project-visual-card" aria-label={visual.label}>
    <VisualThumb pid={pid} visual={visual} />
    <div className="project-visual-badges">
      <span className="badge">{VISUAL_KIND_LABELS[visual.kind]}</span>
      {visual.featured && <span className="badge featured">一押し</span>}
    </div>
    {editing
      ? <form onSubmit={(e) => { void save(e); }} className="project-visual-edit">
        <VisualFields value={draft} onChange={setDraft} disabled={busy} />
        <div className="project-visual-actions">
          <button className="primary" type="submit" disabled={busy}>{busy ? '保存中…' : '保存'}</button>
          <button type="button" disabled={busy} onClick={() => { setDraft(fieldsOf(visual)); setEditing(false); setError(null); }}>やめる</button>
        </div>
      </form>
      : <>
        <strong className="project-visual-label">{visual.label}</strong>
        {visual.note && <p className="project-visual-note">{visual.note}</p>}
        {canEdit && <div className="project-visual-actions">
          <button type="button" disabled={busy} onClick={() => { setDraft(fieldsOf(visual)); setEditing(true); }}>直す</button>
          <button type="button" disabled={busy} onClick={() => { void toggleFeatured(); }}>{visual.featured ? '一押しを外す' : '一押しにする'}</button>
          <button type="button" disabled={busy} onClick={() => { void remove(); }}>削除</button>
        </div>}
      </>}
    {error && <p role="alert" className="project-visual-error">{error}</p>}
  </article>;
}
