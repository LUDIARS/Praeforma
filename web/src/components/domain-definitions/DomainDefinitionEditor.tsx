// ドメイン 1 件の価値定義と各関連付け (spec/feature/domain-definition-links.md)。
// PF-DL-INV2 (露出不足を警告) / PF-DL-INV3 (候補取得失敗を空一覧で隠さない) /
// PF-DL-INV4 (保存失敗時もフォームを保持する)。

import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '../../lib/api.ts';
import { domainDefinitionsApi as api, type DefinedDomain, type DomainDefinitions, type DefinitionInput } from '../../lib/domain-definitions-api.ts';

export function DomainDefinitionEditor({ pid, domain, data, onSaved }: {
  pid: string; domain: DefinedDomain; data: DomainDefinitions; onSaved: () => Promise<void>;
}): React.ReactElement {
  const [draft, setDraft] = React.useState<DefinitionInput>({
    kind: domain.definitionKind ?? 'business', value: domain.definitionValue,
    sceneIds: domain.definitionSceneIds, anatomiaDomain: domain.anatomiaDomain,
    expectedRevision: domain.definitionRevision,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const catalog = useQuery({ queryKey: ['definition-anatomia', pid], queryFn: () => api.catalog(pid), enabled: !!domain.definitionKind });
  const missingScenes = draft.sceneIds.filter((id) => !data.scenes.some((s) => s.id === id));

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault(); setBusy(true); setError(null); setSaved(false);
    try {
      const result = await api.save(pid, domain.id, draft);
      setDraft({ ...draft, expectedRevision: result.revision });
      await onSaved(); setSaved(true);
    }
    catch (e) {
      const err = e as ApiError;
      const code = (err.body as { error?: string } | null)?.error;
      if (code === 'scene_not_available') {
        // 一覧を取り直すと無効な参照が missingScenes として出るので、 そこから外せる。
        // 再取得の失敗でエラー表示を落とさない (入力は保持したまま原因を出す)。
        await onSaved().catch(() => undefined);
        setError('選択したシーン定義が削除されたか、別プロジェクトのものです。一覧を取得し直しました。');
      } else if (err.status === 409) {
        setError('定義が他で更新されました。入力を控えてから一覧を再取得してください。');
      } else {
        setError('保存できませんでした。権限・露出先・Anatomiaの状態を確認してください。入力は残っています。');
      }
    } finally { setBusy(false); }
  }
  async function link(sid: string, linked: boolean): Promise<void> {
    setBusy(true); setError(null);
    try { await api.linkRequirement(pid, domain.id, sid, linked); await onSaved(); }
    catch { setError('要件の関連付けを保存できませんでした。'); }
    finally { setBusy(false); }
  }
  return <section className="panel">
    <h3>{domain.name}</h3>
    {domain.description && <p style={{ whiteSpace: 'pre-wrap' }}>{domain.description}</p>}
    <form onSubmit={(event) => { void save(event); }}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, display: 'grid', gap: 16 }}>
        <label>分類 <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DefinitionInput['kind'] })}>
          <option value="business">ビジネスドメイン</option><option value="core">コアドメイン</option>
        </select></label>
        <label>提供する価値
          <textarea required maxLength={4000} rows={5} value={draft.value}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            style={{ display: 'block', boxSizing: 'border-box', width: '100%', fontSize: 16 }} />
        </label>
        <div><strong>露出するシーン定義</strong>
          <p>コアドメインの価値を露出させるシーンを選びます。未選択でも保存できます。</p>
          {draft.kind === 'core' && !draft.sceneIds.some((id) => data.scenes.some((s) => s.id === id))
            && <p role="status">⚠ 露出するシーン定義がありません。</p>}
          {data.scenes.length === 0 && <p>シーン定義がありません。<Link to={`/projects/${pid}?tab=layouts`}>シーンを登録する</Link></p>}
          {data.scenes.map((s) => <label key={s.id} style={{ display: 'block', padding: '8px 0' }}>
            <input type="checkbox" checked={draft.sceneIds.includes(s.id)} onChange={(e) => setDraft({ ...draft,
              sceneIds: e.target.checked ? [...draft.sceneIds, s.id] : draft.sceneIds.filter((id) => id !== s.id) })} /> {s.name}
          </label>)}
          {missingScenes.length > 0 && <p role="alert">参照できないシーンがあります。
            <button type="button" onClick={() => setDraft({ ...draft, sceneIds: draft.sceneIds.filter((id) => !missingScenes.includes(id)) })}>無効な参照を外す</button>
          </p>}
        </div>
        <label>Anatomiaのドメイン
          {!domain.definitionKind ? <p>価値と分類を保存した後に関連付けできます。</p> : <>
            {catalog.isPending && <p>候補を取得中…</p>}
            {catalog.isError && <p role="alert">Anatomiaの候補を取得できません。
              <button type="button" onClick={() => { void catalog.refetch(); }}>再取得</button></p>}
            <select value={draft.anatomiaDomain ?? ''} onChange={(e) => setDraft({ ...draft, anatomiaDomain: e.target.value || null })}>
              <option value="">未関連付け</option>
              {draft.anatomiaDomain && !catalog.data?.catalog.some((d) => d.name === draft.anatomiaDomain)
                && <option value={draft.anatomiaDomain}>{draft.anatomiaDomain}（要確認）</option>}
              {catalog.data?.catalog.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </>}
        </label>
        <button type="submit" className="primary" disabled={!draft.value.trim() || missingScenes.length > 0}>定義を保存</button>
      </fieldset>
    </form>
    <h4>関連する要件定義</h4>
    {!domain.definitionKind && <p>先にドメインの価値と分類を保存してください。</p>}
    {data.requirements.length === 0 && <p>要件定義がありません。<Link to={`/projects/${pid}?tab=specs`}>仕様を登録する</Link></p>}
    {data.requirements.map((s) => <label key={s.id} style={{ display: 'block', padding: '8px 0' }}>
      <input type="checkbox" disabled={busy || !domain.definitionKind}
        checked={data.links.some((l) => l.domainId === domain.id && l.specId === s.id)}
        onChange={(e) => { void link(s.id, e.target.checked); }} /> {s.code} — {s.title}
    </label>)}
    {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    {draft.expectedRevision !== domain.definitionRevision && <div role="status">
      一覧の定義と編集中の版が異なります。入力は保持しています。
      <button type="button" disabled={busy} onClick={() => {
        setDraft({ kind: domain.definitionKind ?? 'business', value: domain.definitionValue,
          sceneIds: domain.definitionSceneIds, anatomiaDomain: domain.anatomiaDomain,
          expectedRevision: domain.definitionRevision }); setError(null); setSaved(false);
      }}>入力を破棄して一覧の定義を読み込む</button>
    </div>}
    {saved && <p role="status">保存しました</p>}
  </section>;
}
