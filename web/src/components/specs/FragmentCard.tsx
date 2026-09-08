import React from 'react';
import { useMutation } from '@tanstack/react-query';
import type { SpecFragment, ImplementationState } from '../../../../shared/spec-fragments.ts';
import { fragmentApi } from '../../lib/spec-fragments-api.ts';
import type { ApiError } from '../../lib/api.ts';

const labels: Record<ImplementationState, string> = { unverified: '未確認', unimplemented: '未実装', implemented: '実装済' };

export function FragmentCard({ fragment, canEdit, onChanged }: {
  fragment: SpecFragment; canEdit: boolean; onChanged: () => Promise<void>;
}): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const [state, setState] = React.useState(fragment.implementationState);
  const [evidence, setEvidence] = React.useState(fragment.implementationEvidence);
  const [revision, setRevision] = React.useState(fragment.revision);
  const mutation = useMutation({
    mutationFn: () => fragmentApi.implementation(fragment.projectId, fragment.id, {
      expectedRevision: revision, implementationState: state, implementationEvidence: evidence,
    }),
    onSuccess: async () => { setEditing(false); await onChanged(); },
  });
  return <article className="fragment-card">
    <div className="fragment-meta"><span>{labels[fragment.implementationState]}</span>
      <time dateTime={fragment.createdAt}>{new Date(fragment.createdAt).toLocaleString()}</time>
      <span>出所: {fragment.source}</span></div>
    <p className="fragment-content">{fragment.content}</p>
    {fragment.implementationEvidence && <p className="fragment-content">確認根拠: {fragment.implementationEvidence}</p>}
    {canEdit && !editing && <button type="button" className="ghost" onClick={() => {
      setState(fragment.implementationState); setEvidence(fragment.implementationEvidence);
      setRevision(fragment.revision); mutation.reset(); setEditing(true);
    }}>実装状態を変更</button>}
    {editing && <form onSubmit={(event) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}>
      <fieldset disabled={mutation.isPending} className="fragment-fields">
        <label>実装状態<select value={state} onChange={(event) => setState(event.target.value as ImplementationState)}>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>確認根拠（実装済の場合は必須）<textarea rows={3} maxLength={4000} required={state === 'implemented'}
          value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
        <div><button type="submit" className="primary" disabled={state === 'implemented' && !evidence.trim()}>保存</button>
          <button type="button" className="ghost" onClick={() => setEditing(false)}>キャンセル</button></div>
      </fieldset>
      {mutation.isError && <p role="alert">{(mutation.error as ApiError).status === 409
        ? '別の変更が保存されています。入力は残っています。最新状態を確認してから変更し直してください。'
        : '保存できませんでした。入力は残っています。'}</p>}
    </form>}
  </article>;
}
