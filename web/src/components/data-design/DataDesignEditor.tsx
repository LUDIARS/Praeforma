/** Owns editing, optimistic revisions and recovery of a project design document. PF-DATA-2/3/4/9. */
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DataDesignResponse, DataDesignSnapshot } from '../../../../shared/data-design.ts';
import { validateDataDesign } from '../../../../shared/data-design-validation.ts';
import type { ApiError } from '../../lib/api.ts';
import { getDataDesign, saveDataDesign } from '../../lib/data-design-api.ts';
import { createDataSet, removeDesignEntities } from '../../lib/data-design-draft.ts';
import { designJson, designMarkdown, downloadDesign } from '../../lib/data-design-export.ts';
import { DataSetEditor } from './DataSetEditor.tsx';
import { DataDesignIssues } from './DataDesignIssues.tsx';

interface Props { pid: string; initial: DataDesignResponse }

export function DataDesignEditor({ pid, initial }: Props): React.ReactElement {
  const cache = useQueryClient();
  const [baseline, setBaseline] = React.useState(initial.snapshot);
  const [draft, setDraft] = React.useState(initial.snapshot.definition);
  const [selectedId, setSelectedId] = React.useState(initial.snapshot.definition.datasets[0]?.id ?? null);
  const [busy, setBusy] = React.useState(false);
  const [editDenied, setEditDenied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState('');
  const [conflict, setConflict] = React.useState(false);
  const [latest, setLatest] = React.useState<DataDesignSnapshot | null>(null);
  const canEdit = initial.canEdit && !editDenied;
  const serializedDraft = React.useMemo(() => JSON.stringify(draft), [draft]);
  const serializedBaseline = React.useMemo(() => JSON.stringify(baseline.definition), [baseline]);
  const dirty = serializedDraft !== serializedBaseline;
  const issues = React.useMemo(() => validateDataDesign(draft), [draft]);
  const hasErrors = issues.some((issue) => issue.severity === 'error');
  const dataset = draft.datasets.find((item) => item.id === selectedId);

  React.useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent): void => { event.preventDefault(); event.returnValue = ''; };
    // BrowserRouter links do not unload the document. Guard those links before its handler runs.
    const beforeLink = (event: MouseEvent): void => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(target instanceof HTMLAnchorElement) || target.download || target.target === '_blank'
        || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      if (target.origin !== location.origin || target.pathname === location.pathname) return;
      if (!window.confirm('未保存のデータ設計があります。保存せずにこの画面を離れますか？')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', beforeLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', beforeLink, true);
    };
  }, [dirty]);

  function addDataset(): void {
    const item = createDataSet(draft.datasets);
    setDraft({ ...draft, datasets: [...draft.datasets, item] }); setSelectedId(item.id); setNotice('');
  }

  function remove(fieldId?: string): void {
    if (!dataset) return;
    const name = fieldId ? dataset.fields.find((field) => field.id === fieldId)?.name : dataset.label || dataset.name;
    if (!window.confirm('「' + name + '」を設計から削除し、この項目への参照を解除しますか？')) return;
    const next = removeDesignEntities(draft, dataset.id, fieldId);
    setDraft(next); setNotice('');
    if (!fieldId) setSelectedId(next.datasets[0]?.id ?? null);
  }

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || !canEdit || !dirty || hasErrors || conflict) return;
    setBusy(true); setError(null); setNotice('');
    try {
      const result = await saveDataDesign(pid, draft, baseline.revision);
      setBaseline(result.snapshot); setDraft(result.snapshot.definition); setLatest(null);
      // canEdit は保存応答では常に true。 GET が返した権限表示を保存で上書きしない。
      cache.setQueryData(['data-design', pid], { ...result, canEdit: initial.canEdit });
      setNotice('設計を保存しました。');
    } catch (failure) {
      const status = (failure as ApiError).status;
      if (status === 409) {
        setConflict(true); setLatest(null);
        setError('ほかの更新が保存されています。入力は保持しました。最新の内容を確認してください。');
      } else if (status === 403) {
        setEditDenied(true); setError('編集権限がありません。入力は設計 JSON に書き出せます。');
      } else if (status === 413) setError('設計の容量が上限（1 MiB）を超えています。説明の量や項目数を減らしてください。入力は保持しています。');
      else if (status === 400) setError('入力形式を確認してください。識別名、保存先、項目数に誤りがあります。入力は保持しています。');
      else setError('保存を確認できませんでした。入力は保持しています。通信を確認して再試行してください。');
    } finally { setBusy(false); }
  }

  async function inspectLatest(): Promise<void> {
    setBusy(true); setError(null);
    try {
      const result = await getDataDesign(pid);
      setLatest(result.snapshot);
      if (!result.canEdit) setEditDenied(true);
    } catch { setError('最新の保存内容を取得できませんでした。入力は保持しています。'); }
    finally { setBusy(false); }
  }

  function useLatest(): void {
    if (!latest || !window.confirm('現在の入力を破棄して、表示中の保存内容から編集をやり直しますか？必要なら先に設計 JSON を書き出してください。')) return;
    setBaseline(latest); setDraft(latest.definition); setSelectedId(latest.definition.datasets[0]?.id ?? null);
    setConflict(false); setLatest(null); setError(null); setNotice('表示中の保存内容を取り込みました。');
  }

  /**
   * 競合後に自分の入力を残したまま保存し直せる唯一の経路。 PF-DATA-9 が禁じるのは
   * 自動での版繰り上げ再送なので、 表示中の最新版を利用者が確認したうえでの明示操作に限る。
   */
  function keepDraftOnLatest(): void {
    if (!latest || !window.confirm('表示中の保存内容を、現在の入力で上書きしますか？相手の変更は失われます。')) return;
    // 版だけ最新へ進め、 比較対象の definition は元のまま残す (= 入力が dirty のまま保存できる)。
    setBaseline({ ...baseline, revision: latest.revision, updatedAt: latest.updatedAt });
    setConflict(false); setLatest(null); setError(null);
    setNotice('版 ' + latest.revision + ' を基準にしました。「設計を保存」で現在の入力を保存できます。');
  }

  function exportDraft(format: 'json' | 'md'): void {
    const snapshot = { ...baseline, definition: draft };
    const contents = format === 'json' ? designJson(snapshot, pid, dirty) : designMarkdown(snapshot, pid, dirty);
    downloadDesign(contents, 'data-design.' + format, format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8');
  }

  return <form className="data-designer" onSubmit={(event) => { void save(event); }}>
    <div className="panel data-toolbar">
      <div><strong>データ設計</strong><p className="data-hint">版 {baseline.revision} / {dirty ? '未保存の変更あり' : '保存内容を表示中'}</p></div>
      <div className="data-actions">
        <button type="button" className="ghost" onClick={() => exportDraft('json')}>設計 JSON</button>
        <button type="button" className="ghost" onClick={() => exportDraft('md')}>保存先一覧</button>
        {canEdit && <button type="submit" className="primary" disabled={busy || !dirty || hasErrors || conflict}>
          {busy ? '処理中…' : '設計を保存'}
        </button>}
      </div>
    </div>
    {!canEdit && <p className="panel">閲覧モードです。設計を変更するにはプロジェクトの編集権限が必要です。</p>}
    {error && <p className="panel data-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {conflict && <section className="panel" aria-label="同時編集の競合">
      <p>入力の書き出しと、最新の保存内容の比較ができます。自動で上書きはしません。</p>
      <button type="button" className="ghost" disabled={busy} onClick={() => { void inspectLatest(); }}>最新の保存内容を表示</button>
      {latest && <>
        <details><summary>保存済みの版 {latest.revision} を確認</summary><pre className="data-comparison">{JSON.stringify(latest.definition, null, 2)}</pre></details>
        <div className="data-actions">
          <button type="button" className="ghost" disabled={busy} onClick={useLatest}>この保存内容から編集をやり直す</button>
          {canEdit && <button type="button" className="ghost" disabled={busy} onClick={keepDraftOnLatest}>現在の入力を残して保存し直す</button>}
        </div>
      </>}
    </section>}
    <div className="data-workspace">
      <aside className="panel data-sidebar">
        <h2>データセット</h2>
        <nav aria-label="データセット一覧">{draft.datasets.map((item) => <button type="button" key={item.id}
          className="data-dataset-tab" aria-pressed={item.id === selectedId} onClick={() => setSelectedId(item.id)}>
          <strong>{item.label || item.name}</strong><span>{item.fields.length} 項目 / {item.kind === 'user' ? 'ユーザー' : 'マスタ'}</span>
        </button>)}</nav>
        {canEdit && <button type="button" className="ghost" disabled={busy || draft.datasets.length >= 100} onClick={addDataset}>データセットを追加</button>}
      </aside>
      <div className="panel data-main">
        {dataset ? <DataSetEditor key={dataset.id} dataset={dataset} design={draft} disabled={busy || !canEdit}
          onChange={(updated) => { setDraft({ ...draft, datasets: draft.datasets.map((item) => item.id === updated.id ? updated : item) }); setNotice(''); }}
          onRemove={remove} /> : <div className="data-empty"><h2>何を保存するか、項目から設計する</h2>
          <p>データセットを追加して、型・参照・論理保存先・保護方針を定義します。</p>
          <p>例: 通知設定 → 通知の有効／無効 → Cr のプロジェクト領域</p>
        </div>}
      </div>
    </div>
    <div className="panel"><DataDesignIssues issues={issues} /></div>
  </form>;
}
