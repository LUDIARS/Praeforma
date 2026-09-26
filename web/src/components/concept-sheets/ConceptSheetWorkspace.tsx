// プロジェクトの企画概要書タブ: 一覧・表示・出力・作成・作り直し・削除 (spec/feature/concept-sheet.md)。
// 生成は裏で走る (PF-CS-9)。走っている間は状態を問い合わせ、終われば一覧を読み直してできた 1 枚を開く。
import React from 'react';
import type { ConceptSheetRecord, ConceptSheetSummary } from '../../../../shared/concept-sheet.ts';
import { conceptSheetApi, conceptSheetError, conceptSheetJobError, type ConceptSheetJob } from '../../lib/concept-sheets-api.ts';
import { ConceptSheetGenerator } from './ConceptSheetGenerator.tsx';
import { ConceptSheetPreview } from './ConceptSheetPreview.tsx';
import '../../styles/concept-sheets.css';

type Mode = 'view' | 'regenerate' | 'new';
/** 生成の状態を問い合わせる間隔。生成は数分〜十数分なので細かく聞かない。 */
const POLL_MS = 10_000;

export function ConceptSheetBadges({ item }: { item: Pick<ConceptSheetSummary, 'freshness'> }): React.ReactElement {
  return <span className="concept-sheet-badges">
    <span className="badge">Astra が作成</span>
    {item.freshness === 'outdated' && <span className="badge warn">UXが更新済み</span>}
  </span>;
}

/** initialSheetId: 一覧ページからのディープリンク (?tab=concept-sheets&sheet=<id>) で最初に開く 1 枚。 */
export function ConceptSheetWorkspace({ pid, initialSheetId }: {
  pid: string; initialSheetId?: string | null;
}): React.ReactElement {
  const [items, setItems] = React.useState<ConceptSheetSummary[]>([]);
  const [canEdit, setCanEdit] = React.useState(false);
  const [sheet, setSheet] = React.useState<ConceptSheetRecord | null>(null);
  const [mode, setMode] = React.useState<Mode>('view');
  const [newId, setNewId] = React.useState(() => crypto.randomUUID());
  const [job, setJob] = React.useState<ConceptSheetJob | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshList = React.useCallback(async (): Promise<void> => {
    const all: ConceptSheetSummary[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await conceptSheetApi.list(pid, offset);
      all.push(...page.items); setCanEdit(page.canEdit);
      if (!page.hasMore) break;
    }
    setItems(all);
  }, [pid]);

  const open = React.useCallback(async (id: string): Promise<void> => {
    setLoading(true); setError(null);
    try { const r = await conceptSheetApi.get(pid, id); setSheet(r.sheet); setCanEdit(r.canEdit); setMode('view'); }
    catch (e) { setError(conceptSheetError(e)); }
    finally { setLoading(false); }
  }, [pid]);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([refreshList(), conceptSheetApi.generation(pid).then((r) => setJob(r.job))])
      .catch((e) => setError(conceptSheetError(e))).finally(() => setLoading(false));
  }, [pid, refreshList]);

  React.useEffect(() => {
    if (initialSheetId) void open(initialSheetId);
  }, [initialSheetId, open]);

  // 走っている生成を待つ。消えたら (= 成功) 一覧を読み直して、その 1 枚を開く。失敗なら理由を出す。
  const runningId = job?.state === 'running' ? job.sheetId : null;
  React.useEffect(() => {
    if (!runningId) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      conceptSheetApi.generation(pid).then(async ({ job: next }) => {
        if (cancelled) return;
        setJob(next);
        if (next?.state === 'running') return;
        await refreshList();
        if (!next) { setNewId(crypto.randomUUID()); await open(runningId); }
      }).catch(() => { /* 一時的な通信失敗は次の問い合わせで取り戻す */ });
    }, POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [pid, runningId, refreshList, open]);

  function started(id: string): void {
    setJob({ sheetId: id, state: 'running', startedAt: new Date().toISOString() });
    setMode('view');
  }

  async function remove(): Promise<void> {
    if (!sheet || !window.confirm(`「${sheet.design.title}」の企画概要書を削除しますか？ 元に戻せません。`)) return;
    setSaving(true); setError(null);
    try { await conceptSheetApi.remove(pid, sheet.id, sheet.revision); setSheet(null); await refreshList(); }
    catch (e) { setError(conceptSheetError(e)); }
    finally { setSaving(false); }
  }

  const generating = job?.state === 'running';
  return <div className="concept-sheet-workspace">
    <h3>企画概要書</h3>
    <div className="concept-sheet-layout">
      <aside aria-label="企画概要書の一覧">
        {canEdit && <button type="button" className="primary" disabled={generating}
          onClick={() => { setSheet(null); setMode('new'); }}>新しく作る</button>}
        {items.map((item) => <button type="button" key={item.id} className="concept-sheet-item"
          aria-pressed={sheet?.id === item.id} onClick={() => { void open(item.id); }}>
          <strong>{item.catchcopy}</strong><span>{item.title}</span><ConceptSheetBadges item={item} />
        </button>)}
        {!loading && !items.length && !error && !generating && <p>まだ企画概要書はありません。</p>}
      </aside>
      <div className="concept-sheet-main">
        {job?.state === 'running' && <p className="concept-sheet-notice" role="status">
          Astra が企画概要書をデザインしています（{job.startedAt.slice(11, 16)} 開始、数分〜十数分）。できたら自動で開きます。</p>}
        {job?.state === 'failed' && <p role="alert">{conceptSheetJobError(job.error)}</p>}
        {error && <p role="alert">{error}</p>}
        {loading && <p role="status">読み込み中…</p>}
        {mode === 'new' && canEdit && !generating && <ConceptSheetGenerator key={newId} pid={pid} sheetId={newId}
          expectedRevision={0} savedImages={[]} onStarted={started} onCancel={() => setMode('view')} />}
        {sheet && mode === 'regenerate' && !generating && <ConceptSheetGenerator key={`${sheet.id}:${sheet.revision}`} pid={pid}
          sheetId={sheet.id} expectedRevision={sheet.revision} savedImages={sheet.images}
          onStarted={started} onCancel={() => setMode('view')} />}
        {sheet && mode === 'view' && <>
          {sheet.freshness === 'outdated' && <p className="concept-sheet-notice" role="status">
            作成後に UX（制約を含む）が更新されています。「作り直す」で最新の内容から作れます。</p>}
          <div className="concept-sheet-actions">
            <ConceptSheetBadges item={sheet} />
            {canEdit && <>
              <button type="button" disabled={saving || generating} onClick={() => setMode('regenerate')}>作り直す（指示を添えられます）</button>
              <button type="button" disabled={saving || generating} onClick={() => { void remove(); }}>削除</button>
            </>}
          </div>
          <ConceptSheetPreview sheet={sheet} />
        </>}
        {!sheet && mode === 'view' && !loading && items.length > 0 && <p>一覧から企画概要書を選んでください。</p>}
      </div>
    </div>
  </div>;
}
