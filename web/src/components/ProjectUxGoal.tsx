// プロジェクト最上位の UX/Goal 入力 (spec/feature/project-ux-goal.md)。
// PF-GOAL-W1 (スマホで改行付き編集) / PF-GOAL-INV2 (保存失敗・競合で入力を消さない) /
// PF-GOAL-INV3 (空欄を許し、 未定義を埋めない) / PF-GOAL-W2 (ストーリーと感情の定義) /
// PF-GOAL-W3 (キャッチコピー。人の文言が正本、 AI が空欄を埋めたものは「AI案」と表示) を担当する。

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ApiError } from '../lib/api.ts';
import { getProjectUxGoal, saveProjectUxGoal, type ProjectUxGoal as Definition } from '../lib/project-ux-goal.ts';
import { CATCHCOPY_MAX } from '../../../shared/catchcopy.ts';

const fields = [
  { key: 'experience', label: '目指す体験', hint: '誰が、どのような体験をできるようにしたいですか？' },
  { key: 'story', label: 'ストーリー（カスタマージャーニー）', hint: '利用者が出会ってから使い続けるまでを、場面ごとに書きます（知る → 始める → 体験する → 続ける など）。各場面で何をして、何が起きますか？' },
  { key: 'emotions', label: 'かかわる感情の定義', hint: '体験にかかわる感情を定義します。どの場面で、どんな感情が、何によって生まれますか？ 狙う感情と避けたい感情を分けて書けます。' },
  { key: 'design', label: '体験の設計', hint: 'その体験を、どのような流れや働きかけで実現しますか？' },
  { key: 'goal', label: 'ゴール（パフォーマンスを発揮している状態）', hint: '目指す体験が成立し、価値を発揮しているとき、何が起きていますか？' },
] as const;

export function ProjectUxGoal({ pid }: { pid: string }): React.ReactElement {
  const query = useQuery({ queryKey: ['project-ux-goal', pid], queryFn: () => getProjectUxGoal(pid) });
  if (query.isPending) return <div className="panel">UX/Goalを読み込み中…</div>;
  if (!query.data) {
    const status = (query.error as ApiError | null)?.status;
    return <div className="panel" role="alert">
      {status === 403 ? 'このプロジェクトのUX/Goalを閲覧する権限がありません。'
        : status === 404 ? 'プロジェクトが見つかりませんでした。'
        : 'UX/Goalを取得できませんでした。未取得を「未記入」とは扱いません。'}
      <button type="button" disabled={query.isFetching}
        onClick={() => { void query.refetch(); }}>再取得</button>
    </div>;
  }
  return <GoalEditor key={pid} pid={pid} initial={query.data.definition} />;
}

function GoalEditor({ pid, initial }: { pid: string; initial: Definition }): React.ReactElement {
  const queryClient = useQueryClient();
  const [baseline, setBaseline] = React.useState(initial);
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const dirty = draft.catchcopy !== baseline.catchcopy || fields.some(({ key }) => draft[key] !== baseline[key]);
  // 文言を書き換えた時点で人の文言になる (保存時にサーバも同じ判定をする)。
  const shownOrigin = draft.catchcopy === baseline.catchcopy ? baseline.catchcopyOrigin : draft.catchcopy ? 'human' : '';

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const result = await saveProjectUxGoal(pid, draft);
      setBaseline(result.definition); setDraft(result.definition); setConflict(false); setSaved(true);
      queryClient.setQueryData(['project-ux-goal', pid], result);
    } catch (e) {
      const status = (e as ApiError).status;
      setConflict(status === 409);
      setError(status === 409
        ? '別の更新が保存されています。入力は残しています。必要な文章を控えてから最新の保存内容を読み直してください。'
        : status === 403 ? '編集権限がありません。入力は残しています。'
        : '保存を確認できませんでした。入力は残しています。通信を確認して再試行してください。');
    } finally { setSaving(false); }
  }

  /** 最新版を取り込む。 keepDraft=true なら入力を保持したまま版だけ進め、 再保存できるようにする。 */
  async function reload(keepDraft: boolean): Promise<void> {
    setSaving(true); setError(null);
    try {
      const result = await getProjectUxGoal(pid);
      setBaseline(result.definition);
      setDraft(keepDraft ? { ...draft, revision: result.definition.revision } : result.definition);
      setConflict(false); setSaved(false);
      queryClient.setQueryData(['project-ux-goal', pid], result);
      if (keepDraft) {
        setError('最新の保存内容を読み込みました。入力はそのままです。'
          + '他者の更新を消していないか確認してから、もう一度保存してください。');
      }
    } catch { setError('再取得できませんでした。入力は残しています。'); }
    finally { setSaving(false); }
  }

  return <form className="panel" onSubmit={(event) => { void save(event); }}>
    <h3>UX/Goal</h3>
    <p>プロジェクトで一番大きく目指すこと。ここからシナリオやコアドメインを考えます。</p>
    <label htmlFor="ux-goal-catchcopy" style={{ display: 'block', marginBottom: 20 }}>
      <strong>キャッチコピー</strong>
      {shownOrigin === 'ai' && <span style={{ marginLeft: 8, fontSize: '0.8rem', padding: '1px 8px', borderRadius: 99,
        border: '1px solid #e0a400', color: '#8a5a00' }}>AI案</span>}
      <span id="ux-goal-catchcopy-hint" style={{ display: 'block', color: 'var(--muted)', margin: '6px 0' }}>
        企画を一言で伝える文言です。企画概要書はこの文言をそのまま載せます（{CATCHCOPY_MAX} 字まで）。
        空のときは企画概要書を作るときに AI が案を入れ、「AI案」と表示します。書き換えると人の文言になります。
      </span>
      <input id="ux-goal-catchcopy" type="text" aria-describedby="ux-goal-catchcopy-hint"
        maxLength={CATCHCOPY_MAX} value={draft.catchcopy} disabled={saving}
        onChange={(event) => { setDraft({ ...draft, catchcopy: event.target.value }); setSaved(false); }}
        style={{ boxSizing: 'border-box', width: '100%', fontSize: 18, padding: '8px 10px' }} />
    </label>
    {fields.map(({ key, label, hint }) => <label key={key} htmlFor={`ux-goal-${key}`}
      style={{ display: 'block', marginBottom: 20 }}>
      <strong>{label}</strong>
      <span id={`ux-goal-${key}-hint`} style={{ display: 'block', color: 'var(--muted)', margin: '6px 0' }}>{hint}</span>
      <textarea id={`ux-goal-${key}`} aria-describedby={`ux-goal-${key}-hint`} rows={6}
        maxLength={20000} value={draft[key]} disabled={saving}
        onChange={(event) => { setDraft({ ...draft, [key]: event.target.value }); setSaved(false); }}
        style={{ boxSizing: 'border-box', width: '100%', minHeight: 144, resize: 'vertical', fontSize: 16, lineHeight: 1.6 }} />
    </label>)}
    {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <button className="primary" type="submit" disabled={saving || !dirty || conflict}
        title={conflict ? '先に最新の版を取り込んでください。' : undefined}>
        {saving ? '処理中…' : '保存'}
      </button>
      <span role="status">{dirty ? '未保存の変更があります。ページを離れる前に保存してください。' : saved ? '保存しました' : '変更はありません'}</span>
      {conflict && <>
        <button type="button" disabled={saving} onClick={() => { void reload(true); }}>
          最新の版を取り込む（入力は保持）
        </button>
        <button type="button" disabled={saving} onClick={() => { void reload(false); }}>
          最新の保存内容に戻す（入力を破棄）
        </button>
      </>}
    </div>
  </form>;
}
