import React from 'react';
import type { UxUseCase, WorkspaceEvidence } from '../../lib/ux-design-api.ts';

export interface EvidenceDraft { targetKind: 'scenario' | 'use_case'; targetId: string; kind: 'implementation' | 'test' | 'manual'; sourceProjectKey: string; sourceRevision: string; sourceRef: string; status: string; }
interface Props { scenarioId: string; useCases: UxUseCase[]; evidence: WorkspaceEvidence[]; isSaving: boolean; onCreate: (draft: EvidenceDraft) => void; }

export function EvidencePanel({ scenarioId, useCases, evidence, isSaving, onCreate }: Props): React.ReactElement {
  const [draft, setDraft] = React.useState<EvidenceDraft>({ targetKind: 'scenario', targetId: scenarioId, kind: 'implementation', sourceProjectKey: '', sourceRevision: '', sourceRef: '', status: 'candidate' });
  const set = <K extends keyof EvidenceDraft>(key: K, value: EvidenceDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <section className="ux-evidence-panel"><h3>実装根拠と検証状況</h3><p>出典プロジェクトと版を必須にし、Mp の mock と MN の実装を別の証拠として記録します。</p>
    <form className="foundation-form ux-evidence-form" onSubmit={(event) => { event.preventDefault(); onCreate(draft); }}>
      <label className="simple-field"><span>対象</span><select value={`${draft.targetKind}:${draft.targetId}`} onChange={(event) => { const [kind, id] = event.target.value.split(':'); setDraft((current) => ({ ...current, targetKind: kind as EvidenceDraft['targetKind'], targetId: id ?? scenarioId })); }}><option value={`scenario:${scenarioId}`}>シナリオ全体</option>{useCases.map((item) => <option key={item.id} value={`use_case:${item.id}`}>{item.title}</option>)}</select></label>
      <label className="simple-field"><span>種類</span><select value={draft.kind} onChange={(event) => set('kind', event.target.value as EvidenceDraft['kind'])}><option value="implementation">実装</option><option value="test">テスト</option><option value="manual">手動確認</option></select></label>
      <label className="simple-field"><span>出典プロジェクト</span><input required value={draft.sourceProjectKey} onChange={(event) => set('sourceProjectKey', event.target.value)} placeholder="Mp または MN" /></label>
      <label className="simple-field"><span>コード・仕様の版</span><input required value={draft.sourceRevision} onChange={(event) => set('sourceRevision', event.target.value)} /></label>
      <label className="simple-field"><span>安定参照</span><input required value={draft.sourceRef} onChange={(event) => set('sourceRef', event.target.value)} placeholder="path / test ID / URL" /></label>
      <label className="simple-field"><span>状態</span><input required value={draft.status} onChange={(event) => set('status', event.target.value)} /></label><button className="primary" type="submit" disabled={isSaving}>根拠を登録</button>
    </form>
    <div className="ux-evidence-grid">{evidence.map((item) => <article key={item.id} className={item.isStale ? 'stale' : ''}><header><strong>{item.kind}</strong><span className={`ux-status ${item.isStale ? 'stale' : item.status}`}>{item.isStale ? '再確認が必要' : item.status}</span></header><div className="ux-evidence-row"><span>{item.sourceProjectKey}@{item.sourceRevision}</span><code>{item.sourceRef}</code><small>{item.targetKind} / {item.targetId}</small></div>{Object.keys(item.payload).length > 0 ? <details><summary>取得したコード・解析情報</summary><pre>{JSON.stringify(item.payload, null, 2)}</pre></details> : null}</article>)}</div>
  </section>;
}
