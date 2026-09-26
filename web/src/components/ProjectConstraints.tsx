// 制約タブ (spec/feature/project-constraints.md)。
// PF-CON-1 (種類・見出し・説明を 1 件ずつ) / PF-CON-2 (版一致の保存・削除、失敗や競合で入力を消さない)。
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CONSTRAINT_KINDS, CONSTRAINT_KIND_LABELS, CONSTRAINT_LIMITS as L, type ProjectConstraint } from '../../../shared/project-constraint.ts';
import { constraintApi, constraintError, type ConstraintInput } from '../lib/project-constraints-api.ts';

const EMPTY: ConstraintInput = { kind: 'planning', title: '', detail: '' };
const KIND_HINTS: Record<ConstraintInput['kind'], string> = {
  planning: '企画として守る条件。UX を縛るものとして UX タブにも出ます（例: 1 プレイは 5 分以内、課金で有利にしない）。',
  technical: '技術的な条件（例: スマホのブラウザで動く、オフラインでも遊べる）。',
  other: '運用・法務・予算・期日などの条件。',
};

export function ProjectConstraints({ pid }: { pid: string }): React.ReactElement {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['project-constraints', pid], queryFn: () => constraintApi.list(pid) });
  const [editing, setEditing] = React.useState<string | null>(null);
  const refresh = (): Promise<void> => queryClient.invalidateQueries({ queryKey: ['project-constraints', pid] });

  if (query.isPending) return <section className="panel"><p role="status">制約を読み込み中…</p></section>;
  if (!query.data) {
    return <section className="panel" role="alert">制約を取得できませんでした。「制約なし」とは扱いません。
      <button type="button" onClick={() => { void query.refetch(); }}>再取得</button></section>;
  }
  const { canEdit, items } = query.data;
  return <section className="panel">
    <h3>制約</h3>
    <p style={{ color: 'var(--muted)' }}>企画・技術・運用などで守る条件を 1 件ずつ書きます。「企画」の制約は UX を縛るものとして UX タブにも出ます。</p>
    {CONSTRAINT_KINDS.map((kind) => {
      const group = items.filter((c) => c.kind === kind);
      return <section key={kind} aria-label={`${CONSTRAINT_KIND_LABELS[kind]}の制約`} style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '8px 0' }}>{CONSTRAINT_KIND_LABELS[kind]}（{group.length}）</h4>
        {group.length === 0 && <p style={{ margin: 0, color: 'var(--muted)' }}>まだありません。</p>}
        {group.map((c) => editing === c.id
          ? <ConstraintForm key={c.id} initial={c} submitLabel="保存" onCancel={() => setEditing(null)}
            onSubmit={async (input) => { await constraintApi.update(pid, c.id, input, c.revision); await refresh(); setEditing(null); }} />
          : <ConstraintItem key={c.id} constraint={c} canEdit={canEdit} onEdit={() => setEditing(c.id)}
            onDelete={async () => { await constraintApi.remove(pid, c.id, c.revision); await refresh(); }} />)}
      </section>;
    })}
    {canEdit && <details>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>制約を追加する</summary>
      <ConstraintForm key={items.length} initial={EMPTY} submitLabel="追加"
        onSubmit={async (input) => { await constraintApi.create(pid, input); await refresh(); }} />
    </details>}
  </section>;
}

function ConstraintItem({ constraint, canEdit, onEdit, onDelete }: {
  constraint: ProjectConstraint; canEdit: boolean; onEdit: () => void; onDelete: () => Promise<void>;
}): React.ReactElement {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function remove(): Promise<void> {
    if (!window.confirm(`制約「${constraint.title}」を削除しますか？`)) return;
    setBusy(true); setError(null);
    try { await onDelete(); } catch (e) { setError(constraintError(e)); } finally { setBusy(false); }
  }
  return <article style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
    <strong style={{ overflowWrap: 'anywhere' }}>{constraint.title}</strong>
    {constraint.detail && <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{constraint.detail}</p>}
    {canEdit && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" disabled={busy} onClick={onEdit}>直す</button>
      <button type="button" disabled={busy} onClick={() => { void remove(); }}>削除</button>
    </div>}
    {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
  </article>;
}

function ConstraintForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: ConstraintInput; submitLabel: string; onSubmit: (input: ConstraintInput) => Promise<void>; onCancel?: () => void;
}): React.ReactElement {
  const [draft, setDraft] = React.useState<ConstraintInput>({ kind: initial.kind, title: initial.title, detail: initial.detail });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!draft.title.trim()) { setError('見出しを書いてください。'); return; }
    setBusy(true); setError(null);
    try { await onSubmit({ ...draft, title: draft.title.trim(), detail: draft.detail.trim() }); }
    catch (e) { setError(constraintError(e)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={(e) => { void submit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
    <label>種類
      <select value={draft.kind} disabled={busy} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ConstraintInput['kind'] })}
        style={{ marginLeft: 8 }}>
        {CONSTRAINT_KINDS.map((k) => <option key={k} value={k}>{CONSTRAINT_KIND_LABELS[k]}</option>)}
      </select>
    </label>
    <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{KIND_HINTS[draft.kind]}</span>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>見出し（1 行、{L.title} 字まで）
      <input type="text" value={draft.title} maxLength={L.title} disabled={busy}
        onChange={(e) => setDraft({ ...draft, title: e.target.value.replace(/\s*\n\s*/g, ' ') })}
        style={{ boxSizing: 'border-box', width: '100%', fontSize: 16 }} />
    </label>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>説明（任意、{L.detail} 字まで）
      <textarea rows={3} value={draft.detail} maxLength={L.detail} disabled={busy}
        onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
        style={{ boxSizing: 'border-box', width: '100%', fontSize: 16, lineHeight: 1.6 }} />
    </label>
    {error && <p role="alert" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
    <div style={{ display: 'flex', gap: 8 }}>
      <button className="primary" type="submit" disabled={busy}>{busy ? '処理中…' : submitLabel}</button>
      {onCancel && <button type="button" disabled={busy} onClick={onCancel}>やめる</button>}
    </div>
  </form>;
}
