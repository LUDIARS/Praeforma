import React from 'react';
import type { UxUseCase } from '../../lib/ux-design-api.ts';

interface Draft {
  title: string;
  userIntent: string;
  trigger: string;
  preconditions: string;
  successOutcome: string;
  failureOutcomes: string;
  interruptionRecovery: string;
}

interface Props {
  useCases: UxUseCase[];
  isSaving: boolean;
  onCreate: (draft: Omit<UxUseCase, 'id' | 'scenarioId' | 'revision'>) => void;
  onUpdate: (useCase: UxUseCase, draft: Omit<UxUseCase, 'id' | 'scenarioId' | 'revision'>) => void;
}

const blank: Draft = { title: '', userIntent: '', trigger: '', preconditions: '', successOutcome: '', failureOutcomes: '', interruptionRecovery: '' };

function lines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function fromUseCase(useCase: UxUseCase): Draft {
  return { title: useCase.title, userIntent: useCase.userIntent, trigger: useCase.trigger, preconditions: useCase.preconditions.join('\n'), successOutcome: useCase.successOutcome, failureOutcomes: useCase.failureOutcomes.join('\n'), interruptionRecovery: useCase.interruptionRecovery };
}

export function UseCasePanel({ useCases, isSaving, onCreate, onUpdate }: Props): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(blank);
  const [submittedCount, setSubmittedCount] = React.useState<number | null>(null);
  const [editing, setEditing] = React.useState<{ useCase: UxUseCase; draft: Draft } | null>(null);
  const set = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  React.useEffect(() => {
    if (submittedCount != null && useCases.length > submittedCount) { setDraft(blank); setOpen(false); setSubmittedCount(null); }
  }, [submittedCount, useCases.length]);
  React.useEffect(() => {
    if (editing && useCases.find((item) => item.id === editing.useCase.id)?.revision !== editing.useCase.revision) setEditing(null);
  }, [editing, useCases]);

  return (
    <section className="ux-use-cases">
      <div className="ux-section-heading"><div><h3>Use cases</h3><p>画面から独立した、利用者の操作と業務上の応答です。</p></div><button className="ghost" type="button" onClick={() => setOpen((value) => !value)}>＋ use case</button></div>
      <div className="ux-use-case-list">{useCases.map((useCase) => <article key={useCase.id}><strong>{useCase.title}</strong><span>{useCase.trigger}: {useCase.userIntent} → {useCase.successOutcome}</span><small>r{useCase.revision} · preconditions {useCase.preconditions.length} · failures {useCase.failureOutcomes.length}</small><button className="ghost" type="button" onClick={() => setEditing({ useCase, draft: fromUseCase(useCase) })}>編集</button></article>)}</div>
      {open ? <form className="foundation-form ux-use-case-form" onSubmit={(event) => {
        event.preventDefault();
        onCreate({ title: draft.title, userIntent: draft.userIntent, trigger: draft.trigger, preconditions: lines(draft.preconditions), successOutcome: draft.successOutcome, failureOutcomes: lines(draft.failureOutcomes), interruptionRecovery: draft.interruptionRecovery.trim(), ordinal: useCases.length });
        setSubmittedCount(useCases.length);
      }}>
        <label className="simple-field"><span>名前</span><input required value={draft.title} onChange={(event) => set('title', event.target.value)} /></label>
        <label className="simple-field"><span>利用者の意図</span><input required value={draft.userIntent} onChange={(event) => set('userIntent', event.target.value)} /></label>
        <label className="simple-field"><span>開始条件</span><input required value={draft.trigger} onChange={(event) => set('trigger', event.target.value)} /></label>
        <label className="simple-field"><span>事前条件（1行ずつ）</span><textarea rows={2} value={draft.preconditions} onChange={(event) => set('preconditions', event.target.value)} /></label>
        <label className="simple-field"><span>成功結果</span><input required value={draft.successOutcome} onChange={(event) => set('successOutcome', event.target.value)} /></label>
        <label className="simple-field"><span>失敗結果（1行ずつ）</span><textarea rows={2} value={draft.failureOutcomes} onChange={(event) => set('failureOutcomes', event.target.value)} /></label>
        <label className="simple-field"><span>中断からの復帰（1行ずつ）</span><textarea rows={2} value={draft.interruptionRecovery} onChange={(event) => set('interruptionRecovery', event.target.value)} /></label>
        <button className="primary" type="submit" disabled={isSaving}>保存</button>
      </form> : null}
      {editing ? <form className="foundation-form ux-use-case-form" onSubmit={(event) => { event.preventDefault(); const value = editing.draft; onUpdate(editing.useCase, { title: value.title, userIntent: value.userIntent, trigger: value.trigger, preconditions: lines(value.preconditions), successOutcome: value.successOutcome, failureOutcomes: lines(value.failureOutcomes), interruptionRecovery: value.interruptionRecovery.trim(), ordinal: editing.useCase.ordinal }); }}>
        <label className="simple-field"><span>名前</span><input required value={editing.draft.title} onChange={(event) => setEditing({ ...editing, draft: { ...editing.draft, title: event.target.value } })} /></label>
        <label className="simple-field"><span>利用者の意図</span><input required value={editing.draft.userIntent} onChange={(event) => setEditing({ ...editing, draft: { ...editing.draft, userIntent: event.target.value } })} /></label>
        <label className="simple-field"><span>開始条件</span><input required value={editing.draft.trigger} onChange={(event) => setEditing({ ...editing, draft: { ...editing.draft, trigger: event.target.value } })} /></label>
        <label className="simple-field"><span>成功結果</span><input required value={editing.draft.successOutcome} onChange={(event) => setEditing({ ...editing, draft: { ...editing.draft, successOutcome: event.target.value } })} /></label>
        <label className="simple-field"><span>事前条件</span><textarea value={editing.draft.preconditions} onChange={(event) => setEditing({ ...editing, draft: { ...editing.draft, preconditions: event.target.value } })} /></label>
        <label className="simple-field"><span>失敗結果</span><textarea value={editing.draft.failureOutcomes} onChange={(event) => setEditing({ ...editing, draft: { ...editing.draft, failureOutcomes: event.target.value } })} /></label>
        <label className="simple-field"><span>中断からの復帰</span><textarea value={editing.draft.interruptionRecovery} onChange={(event) => setEditing({ ...editing, draft: { ...editing.draft, interruptionRecovery: event.target.value } })} /></label>
        <div><button className="primary" type="submit" disabled={isSaving}>更新</button><button className="ghost" type="button" onClick={() => setEditing(null)}>閉じる</button></div>
      </form> : null}
    </section>
  );
}
