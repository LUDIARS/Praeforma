// プロジェクトの企画概要書タブ: 一覧・表示・出力・作成・作り直し・削除 (spec/feature/concept-sheet.md)。
// 生成は裏で走る (PF-CS-9)。走っている間は状態を問い合わせ、終われば一覧を読み直してできた 1 枚を開く。
// 版 (rv) を切り替えて見る・印刷する・保存する (PF-CS-10)。自動更新の ON/OFF と、予約・実行・失敗を出す (PF-CS-11)。
import React from 'react';
import type { ConceptSheetGenerationStatus, ConceptSheetSummary } from '../../../../shared/concept-sheet.ts';
import { conceptSheetApi, conceptSheetError, type ConceptSheetView } from '../../lib/concept-sheets-api.ts';
import { ConceptSheetGenerator } from './ConceptSheetGenerator.tsx';
import { ConceptSheetPreview } from './ConceptSheetPreview.tsx';
import { ConceptSheetStatus } from './ConceptSheetStatus.tsx';
import { ConceptSheetVersionBar } from './ConceptSheetVersionBar.tsx';
import '../../styles/concept-sheets.css';

type Mode = 'view' | 'regenerate' | 'new';
/** 生成の状態を問い合わせる間隔。生成は数分〜十数分なので細かく聞かない。 */
const POLL_MS = 10_000;

export function ConceptSheetBadges({ item }: { item: Pick<ConceptSheetSummary, 'freshness' | 'rv' | 'autoUpdate'> }): React.ReactElement {
  return <span className="concept-sheet-badges">
    <span className="badge">rv{item.rv}</span>
    <span className="badge">Astra が作成</span>
    {item.freshness === 'outdated' && <span className="badge warn">UXが更新済み</span>}
    {!item.autoUpdate && <span className="badge">自動更新 OFF</span>}
  </span>;
}

/** initialSheetId: 一覧ページからのディープリンク (?tab=concept-sheets&sheet=<id>) で最初に開く 1 枚。 */
export function ConceptSheetWorkspace({ pid, initialSheetId }: {
  pid: string; initialSheetId?: string | null;
}): React.ReactElement {
  const [items, setItems] = React.useState<ConceptSheetSummary[]>([]);
  const [canEdit, setCanEdit] = React.useState(false);
  const [view, setView] = React.useState<ConceptSheetView | null>(null);
  const [mode, setMode] = React.useState<Mode>('view');
  const [newId, setNewId] = React.useState(() => crypto.randomUUID());
  const [status, setStatus] = React.useState<ConceptSheetGenerationStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const viewRef = React.useRef(view);
  viewRef.current = view;
  const sheet = view?.sheet ?? null;

  const refreshList = React.useCallback(async (): Promise<void> => {
    const all: ConceptSheetSummary[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await conceptSheetApi.list(pid, offset);
      all.push(...page.items); setCanEdit(page.canEdit);
      if (!page.hasMore) break;
    }
    setItems(all);
  }, [pid]);

  const show = React.useCallback(async (load: () => Promise<ConceptSheetView>): Promise<void> => {
    setLoading(true); setError(null);
    try { const next = await load(); setView(next); setCanEdit(next.canEdit); setMode('view'); }
    catch (e) { setError(conceptSheetError(e)); }
    finally { setLoading(false); }
  }, []);
  const open = React.useCallback((id: string) => show(() => conceptSheetApi.get(pid, id)), [pid, show]);
  const openVersion = (rv: number): void => { if (sheet) void show(() => conceptSheetApi.getVersion(pid, sheet.id, rv)); };

  React.useEffect(() => {
    setLoading(true);
    Promise.all([refreshList(), conceptSheetApi.generation(pid).then(setStatus)])
      .catch((e) => setError(conceptSheetError(e))).finally(() => setLoading(false));
  }, [pid, refreshList]);

  React.useEffect(() => {
    if (initialSheetId) void open(initialSheetId);
  }, [initialSheetId, open]);

  // 生成が走っている・自動更新を予約している間は状態を問い合わせる。走っていた生成が消えたら (= 成功)
  // 一覧を読み直す。人の作成・作り直しならその 1 枚を開き、自動更新なら開いている最新版を新しい版へ読み替える。
  const running = status?.job?.state === 'running' ? { sheetId: status.job.sheetId, trigger: status.job.trigger } : null;
  const watching = running !== null || !!status?.autoUpdate.scheduledAt;
  const runningRef = React.useRef(running);
  runningRef.current = running;
  React.useEffect(() => {
    if (!watching) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      conceptSheetApi.generation(pid).then(async (next) => {
        if (cancelled) return;
        const before = runningRef.current;
        setStatus(next);
        if (!before || next.job?.state === 'running') return;
        await refreshList();
        if (next.job) return;
        const current = viewRef.current?.sheet;
        if (before.trigger === 'manual') { setNewId(crypto.randomUUID()); await open(before.sheetId); }
        else if (current?.id === before.sheetId && current.rv === current.latestRv) await open(before.sheetId);
      }).catch(() => { /* 一時的な通信失敗は次の問い合わせで取り戻す */ });
    }, POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [pid, watching, refreshList, open]);

  function started(id: string): void {
    setStatus((current) => ({ job: { sheetId: id, trigger: 'manual', state: 'running', startedAt: new Date().toISOString() },
      autoUpdate: current?.autoUpdate ?? { scheduledAt: null } }));
    setMode('view');
  }

  async function act(work: () => Promise<void>): Promise<void> {
    setSaving(true); setError(null);
    try { await work(); } catch (e) { setError(conceptSheetError(e)); } finally { setSaving(false); }
  }
  const remove = (): Promise<void> => act(async () => {
    if (!sheet || !window.confirm(`「${sheet.design.title}」の企画概要書を、すべての版とともに削除しますか？ 元に戻せません。`)) return;
    await conceptSheetApi.remove(pid, sheet.id, sheet.revision); setView(null); await refreshList();
  });
  const setAutoUpdate = (enabled: boolean): Promise<void> => act(async () => {
    if (!sheet) return;
    await conceptSheetApi.setAutoUpdate(pid, sheet.id, enabled);
    setView((current) => (current ? { ...current, sheet: { ...current.sheet, autoUpdate: enabled } } : current));
    await refreshList();
    setStatus(await conceptSheetApi.generation(pid));
  });

  const generating = status?.job?.state === 'running';
  const latest = sheet !== null && sheet.rv === sheet.latestRv;
  return <div className="concept-sheet-workspace">
    <h3>企画概要書</h3>
    <div className="concept-sheet-layout">
      <aside aria-label="企画概要書の一覧">
        {canEdit && <button type="button" className="primary" disabled={generating}
          onClick={() => { setView(null); setMode('new'); }}>新しく作る</button>}
        {items.map((item) => <button type="button" key={item.id} className="concept-sheet-item"
          aria-pressed={sheet?.id === item.id} onClick={() => { void open(item.id); }}>
          <strong>{item.catchcopy}</strong><span>{item.title}</span><ConceptSheetBadges item={item} />
        </button>)}
        {!loading && !items.length && !error && !generating && <p>まだ企画概要書はありません。</p>}
      </aside>
      <div className="concept-sheet-main">
        <ConceptSheetStatus status={status} titleOf={(id) => items.find((i) => i.id === id)?.title} />
        {error && <p role="alert">{error}</p>}
        {loading && <p role="status">読み込み中…</p>}
        {mode === 'new' && canEdit && !generating && <ConceptSheetGenerator key={newId} pid={pid} sheetId={newId}
          expectedRevision={0} previousVisualIds={[]} previousLabels={[]} onStarted={started} onCancel={() => setMode('view')} />}
        {sheet && mode === 'regenerate' && !generating && <ConceptSheetGenerator key={`${sheet.id}:${sheet.revision}`} pid={pid}
          sheetId={sheet.id} expectedRevision={sheet.revision} previousVisualIds={sheet.visuals.map((v) => v.visualId)}
          previousLabels={sheet.images.map((i) => i.label)} onStarted={started} onCancel={() => setMode('view')} />}
        {view && sheet && mode === 'view' && <>
          {latest && sheet.freshness === 'outdated' && <p className="concept-sheet-notice" role="status">
            作成後に UX（制約を含む）・仕様・使っているビジュアルが更新されています。
            {sheet.autoUpdate ? '変更が落ち着いたら自動で新しい版を作ります。すぐ作るなら「作り直す」を押します。' : '「作り直す」で最新の内容から作れます。'}</p>}
          {!latest && <p className="concept-sheet-hint" role="status">過去の版（rv{sheet.rv}）を表示しています。印刷・保存もこの版で行います。</p>}
          <ConceptSheetVersionBar sheet={sheet} versions={view.versions} canEdit={canEdit} disabled={saving || loading}
            onSelect={openVersion} onAutoUpdate={(enabled) => { void setAutoUpdate(enabled); }} />
          <div className="concept-sheet-actions">
            {/* 古い版はふつう材料と食い違うので、「UXが更新済み」は最新版にだけ出す。 */}
            <ConceptSheetBadges item={latest ? sheet : { ...sheet, freshness: 'current' }} />
            {canEdit && latest && <>
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
