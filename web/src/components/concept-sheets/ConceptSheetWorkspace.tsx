// プロジェクトの企画概要書タブ: 一覧・表示・出力・修正・作り直し・削除 (spec/feature/concept-sheet.md)。
import React from 'react';
import type { ConceptSheetRecord, ConceptSheetSummary } from '../../../../shared/concept-sheet.ts';
import { conceptSheetApi, conceptSheetError } from '../../lib/concept-sheets-api.ts';
import { ConceptSheetGenerator } from './ConceptSheetGenerator.tsx';
import { ConceptSheetPreview } from './ConceptSheetPreview.tsx';
import { ConceptSheetEditor } from './ConceptSheetEditor.tsx';
import '../../styles/concept-sheets.css';

type Mode = 'view' | 'edit' | 'regenerate' | 'new';

export function ConceptSheetBadges({ item }: { item: Pick<ConceptSheetSummary, 'status' | 'freshness' | 'hasKeyVisual'> }): React.ReactElement {
  return <span className="concept-sheet-badges">
    <span className="badge">{item.status === 'edited' ? '人が修正' : 'AI が作成'}</span>
    {item.freshness === 'outdated' && <span className="badge warn">UX/ゴールが更新済み</span>}
    {!item.hasKeyVisual && <span className="badge">キービジュアルなし</span>}
  </span>;
}

/** initialSheetId: 一覧ページからのディープリンク (?tab=concept-sheets&sheet=<id>) で最初に開く 1 枚。 */
export function ConceptSheetWorkspace({ pid, projectName, initialSheetId }: {
  pid: string; projectName: string; initialSheetId?: string | null;
}): React.ReactElement {
  const [items, setItems] = React.useState<ConceptSheetSummary[]>([]);
  const [canEdit, setCanEdit] = React.useState(false);
  const [sheet, setSheet] = React.useState<ConceptSheetRecord | null>(null);
  const [mode, setMode] = React.useState<Mode>('view');
  const [newId, setNewId] = React.useState(() => crypto.randomUUID());
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
    refreshList().catch((e) => setError(conceptSheetError(e))).finally(() => setLoading(false));
  }, [refreshList]);

  React.useEffect(() => {
    if (initialSheetId) void open(initialSheetId);
  }, [initialSheetId, open]);

  async function afterGenerated(id: string): Promise<void> {
    setNewId(crypto.randomUUID());
    await refreshList().catch(() => { /* 一覧の再取得に失敗しても、作った 1 枚は開ける */ });
    await open(id);
  }

  async function save(document: ConceptSheetRecord['document']): Promise<void> {
    if (!sheet) return;
    setSaving(true); setError(null);
    try { await conceptSheetApi.save(pid, sheet.id, document, sheet.revision); await refreshList(); await open(sheet.id); }
    catch (e) { setError(conceptSheetError(e)); }
    finally { setSaving(false); }
  }

  async function remove(): Promise<void> {
    if (!sheet || !window.confirm(`「${sheet.document.title}」の企画概要書を削除しますか？ 元に戻せません。`)) return;
    setSaving(true); setError(null);
    try { await conceptSheetApi.remove(pid, sheet.id, sheet.revision); setSheet(null); await refreshList(); }
    catch (e) { setError(conceptSheetError(e)); }
    finally { setSaving(false); }
  }

  return <div className="concept-sheet-workspace">
    <h3>企画概要書</h3>
    <div className="concept-sheet-layout">
      <aside aria-label="企画概要書の一覧">
        {canEdit && <button type="button" className="primary" onClick={() => { setSheet(null); setMode('new'); }}>新しく作る</button>}
        {items.map((item) => <button type="button" key={item.id} className="concept-sheet-item"
          aria-pressed={sheet?.id === item.id} onClick={() => { void open(item.id); }}>
          <strong>{item.catchcopy}</strong><span>{item.title}</span><ConceptSheetBadges item={item} />
        </button>)}
        {!loading && !items.length && !error && <p>まだ企画概要書はありません。</p>}
      </aside>
      <div className="concept-sheet-main">
        {error && <p role="alert">{error}</p>}
        {loading && <p role="status">読み込み中…</p>}
        {mode === 'new' && canEdit && <ConceptSheetGenerator key={newId} pid={pid} sheetId={newId} expectedRevision={0}
          hasSavedVisual={false} onGenerated={(id) => { void afterGenerated(id); }} onCancel={() => setMode('view')} />}
        {sheet && mode === 'regenerate' && <ConceptSheetGenerator key={`${sheet.id}:${sheet.revision}`} pid={pid} sheetId={sheet.id}
          expectedRevision={sheet.revision} hasSavedVisual={sheet.keyVisual !== null}
          onGenerated={(id) => { void afterGenerated(id); }} onCancel={() => setMode('view')} />}
        {sheet && mode === 'edit' && <ConceptSheetEditor key={`${sheet.id}:${sheet.revision}`} initial={sheet.document} saving={saving}
          onSave={save} onCancel={() => setMode('view')} />}
        {sheet && mode === 'view' && <>
          {sheet.freshness === 'outdated' && <p className="concept-sheet-notice" role="status">
            作成後に UX/ゴールが更新されています。「作り直す」で最新の内容から作れます。</p>}
          <div className="concept-sheet-actions">
            <ConceptSheetBadges item={{ status: sheet.status, freshness: sheet.freshness, hasKeyVisual: sheet.keyVisual !== null }} />
            {canEdit && <>
              <button type="button" disabled={saving} onClick={() => setMode('edit')}>文面を直す</button>
              <button type="button" disabled={saving} onClick={() => setMode('regenerate')}>作り直す</button>
              <button type="button" disabled={saving} onClick={() => { void remove(); }}>削除</button>
            </>}
          </div>
          <ConceptSheetPreview projectName={projectName} sheet={sheet} />
        </>}
        {!sheet && mode === 'view' && !loading && items.length > 0 && <p>一覧から企画概要書を選んでください。</p>}
      </div>
    </div>
  </div>;
}
