import React from 'react';
import type { BoundaryDecision, BoundaryDefinition, BoundaryProposal, ProposalDecisionAction, UxAnalysis, UxUseCase } from '../../lib/ux-design-api.ts';

interface Props {
  proposals: BoundaryProposal[];
  decisions: BoundaryDecision[];
  analysis: UxAnalysis | null;
  isAnalyzing: boolean;
  isDeciding: boolean;
  onAnalyze: (note: string, visibility: 'public' | 'sensitive') => void;
  onDecide: (proposal: BoundaryProposal, action: ProposalDecisionAction, rationale: string, boundaries: BoundaryDefinition[]) => void;
  onFetchAnatomia: (proposal: BoundaryProposal, query: string) => void;
  isFetchingAnatomia: boolean;
  useCases: UxUseCase[];
}

const actionLabels: Record<ProposalDecisionAction, string> = { accept: '採用', reject: '却下', revise: '修正', split: '分割', merge: '統合' };

function proposalBoundary(proposal: BoundaryProposal): BoundaryDefinition {
  return {
    name: proposal.name,
    responsibility: proposal.purpose,
    classification: proposal.classification,
    in_scope: proposal.inScope,
    out_of_scope: proposal.outOfScope,
    rules: proposal.businessRules,
    ubiquitous_language: [],
    interactions: proposal.collaborations,
    use_case_ids: proposal.useCaseIds,
  };
}

type BoundaryDraft = Omit<BoundaryDefinition, 'in_scope' | 'out_of_scope' | 'rules' | 'ubiquitous_language' | 'interactions' | 'use_case_ids'> & {
  key: string; inScope: string; outOfScope: string; rules: string; language: string; interactions: string; useCaseIds: string;
};
const lineList = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);
const toDraft = (boundary: BoundaryDefinition): BoundaryDraft => ({ key: crypto.randomUUID(), name: boundary.name, responsibility: boundary.responsibility, classification: boundary.classification, inScope: boundary.in_scope.join('\n'), outOfScope: boundary.out_of_scope.join('\n'), rules: boundary.rules.join('\n'), language: boundary.ubiquitous_language.join('\n'), interactions: boundary.interactions.join('\n'), useCaseIds: boundary.use_case_ids.join('\n') });
const toBoundary = (draft: BoundaryDraft): BoundaryDefinition => ({ name: draft.name, responsibility: draft.responsibility, classification: draft.classification, in_scope: lineList(draft.inScope), out_of_scope: lineList(draft.outOfScope), rules: lineList(draft.rules), ubiquitous_language: lineList(draft.language), interactions: lineList(draft.interactions), use_case_ids: lineList(draft.useCaseIds) });

function BoundaryEditor({ value, useCases, onChange }: { value: BoundaryDefinition[]; useCases: UxUseCase[]; onChange: (next: BoundaryDefinition[]) => void }): React.ReactElement {
  const [drafts, setDrafts] = React.useState(() => value.map(toDraft));
  const commit = (next: BoundaryDraft[]) => { setDrafts(next); onChange(next.map(toBoundary)); };
  const patch = (key: string, update: Partial<BoundaryDraft>) => commit(drafts.map((draft) => draft.key === key ? { ...draft, ...update } : draft));
  return <div className="ux-boundary-editor">{drafts.map((draft) => <div key={draft.key} className="ux-boundary-card foundation-form">
    <input aria-label="境界名" value={draft.name} onChange={(event) => patch(draft.key, { name: event.target.value })} />
    <select aria-label="分類" value={draft.classification} onChange={(event) => patch(draft.key, { classification: event.target.value as BoundaryDefinition['classification'] })}><option value="core">UX core</option><option value="supporting">supporting (Anatomia)</option><option value="generic">generic (Anatomia)</option></select>
    <textarea aria-label="責務" rows={2} value={draft.responsibility} onChange={(event) => patch(draft.key, { responsibility: event.target.value })} />
    {([['inScope', '境界内'], ['outOfScope', '境界外'], ['rules', '業務ルール'], ['language', '共通語彙'], ['interactions', '境界間のやり取り']] as const).map(([field, label]) => <label key={field} className="simple-field"><span>{label}（1行ずつ）</span><textarea rows={2} value={draft[field]} onChange={(event) => patch(draft.key, { [field]: event.target.value })} /></label>)}
    <fieldset className="ux-use-case-choices"><legend>担当する use case</legend>{useCases.map((useCase) => { const selected = lineList(draft.useCaseIds).includes(useCase.id); return <label key={useCase.id}><input type="checkbox" checked={selected} onChange={(event) => { const ids = lineList(draft.useCaseIds); patch(draft.key, { useCaseIds: (event.target.checked ? [...ids, useCase.id] : ids.filter((id) => id !== useCase.id)).join('\n') }); }} />{useCase.title}</label>; })}</fieldset>
    <button className="danger" type="button" onClick={() => commit(drafts.filter((item) => item.key !== draft.key))}>境界を削除</button>
  </div>)}<button className="ghost" type="button" onClick={() => commit([...drafts, toDraft({ name: '新しい境界', responsibility: '', classification: 'core', in_scope: [], out_of_scope: [], rules: [], ubiquitous_language: [], interactions: [], use_case_ids: [] })])}>＋ 境界を追加</button></div>;
}

export function BoundaryPanel({ proposals, decisions, analysis, isAnalyzing, isDeciding, onAnalyze, onDecide, onFetchAnatomia, isFetchingAnatomia, useCases }: Props): React.ReactElement {
  const [note, setNote] = React.useState('');
  const [visibility, setVisibility] = React.useState<'public' | 'sensitive'>('sensitive');
  const [rationales, setRationales] = React.useState<Record<string, string>>({});
  const [boundaryDrafts, setBoundaryDrafts] = React.useState<Record<string, BoundaryDefinition[]>>({});
  const [anatomiaQueries, setAnatomiaQueries] = React.useState<Record<string, string>>({});
  const currentProposalIds = new Set(proposals.filter((proposal) => proposal.isCurrent && proposal.analysisId === analysis?.id).map((proposal) => proposal.id));
  const currentDecisions = decisions.filter((decision) => currentProposalIds.has(decision.proposalId) && decision.action !== 'reject');

  return (
    <section className="ux-review-panel">
      <div className="ux-section-heading">
        <div><h3>UX コアドメインの境界案</h3><p>LLM の分解案と Genius の判断根拠を、人間が採否・分割・統合します。</p></div>
      </div>
      <form className="ux-analysis-form foundation-form" onSubmit={(event) => { event.preventDefault(); onAnalyze(note.trim(), visibility); }}>
        <label className="simple-field"><span>解析時の補足</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="境界判断で重視すること" /></label>
        <label className="simple-field"><span>資料の可視性</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as 'public' | 'sensitive')}><option value="public">公開可能</option><option value="sensitive">機密を含む</option></select></label>
        <button className="primary" type="submit" disabled={isAnalyzing}>{isAnalyzing ? '解析中…' : '分解・境界案を生成'}</button>
      </form>
      {analysis?.geniusQuery ? <details className="ux-genius-evidence"><summary>Genius 参照候補 ({analysis.geniusQuery.cards.length})</summary>{analysis.geniusQuery.cards.map((card) => <div key={card.id} className="ux-genius-card"><strong>{card.judgment}</strong><span>{card.situation}</span><small>{card.rationale} · confidence {Math.round(card.confidence * 100)}%</small></div>)}</details> : null}
      {currentDecisions.length > 0 ? <div className="ux-current-boundaries"><h4>最新解析に対して確定した現在の境界</h4>{currentDecisions.flatMap((decision) => decision.resultBoundaries.map((boundary) => ({ decision, boundary }))).map(({ decision, boundary }, index) => <article key={`${decision.id}:${index}`} className={boundary.classification === 'core' ? 'core' : 'external'}><strong>{boundary.name}</strong><span>{boundary.classification === 'core' ? 'UX core' : 'Anatomia 管理候補'}</span><p>{boundary.responsibility}</p></article>)}</div> : null}
      <div className="ux-proposal-list">
        {proposals.map((proposal) => (
          <article key={proposal.id} className="ux-proposal-card">
            <header><h4>{proposal.name}</h4><span className={`ux-status ${proposal.status}`}>{proposal.status}</span>{!proposal.isCurrent ? <span className="ux-status stale">要再解析</span> : null}</header>
            <p>{proposal.rationale}</p>
            {proposal.confidence != null ? <small>LLM confidence {Math.round(proposal.confidence)}%</small> : null}
            {proposal.status === 'pending' && proposal.isCurrent ? <BoundaryEditor value={boundaryDrafts[proposal.id] ?? [proposalBoundary(proposal)]} useCases={useCases} onChange={(next) => setBoundaryDrafts((current) => ({ ...current, [proposal.id]: next }))} /> : <div className="ux-boundary-card"><strong>{proposal.name}</strong><p>{proposal.purpose}</p><span>確定済みまたは旧版のため読み取り専用です。</span></div>}
            {proposal.existingDomainRefs.length > 0 ? <p className="ux-genius-card">Anatomia 既存参照: {proposal.existingDomainRefs.join(' / ')}</p> : null}
            <div className="ux-anatomia-search"><input value={anatomiaQueries[proposal.id] ?? ''} onChange={(event) => setAnatomiaQueries((current) => ({ ...current, [proposal.id]: event.target.value }))} placeholder={`${proposal.name} の実装を Anatomia で検索`} /><button className="ghost" type="button" disabled={isFetchingAnatomia || !(anatomiaQueries[proposal.id]?.trim())} onClick={() => onFetchAnatomia(proposal, anatomiaQueries[proposal.id]?.trim() ?? '')}>実装根拠を取得</button></div>
            {proposal.geniusAssessments.length > 0 ? <details><summary>この案への Genius 適用根拠</summary>{proposal.geniusAssessments.map((item) => <div className="ux-genius-card" key={item.card_id}><strong>{item.applicability}</strong><span>{item.rationale}</span></div>)}</details> : <p className="ux-warning">適用できる Genius 判断はありません。</p>}
            {proposal.unresolvedQuestions.length > 0 ? <ul>{proposal.unresolvedQuestions.map((question) => <li key={question}>{question}</li>)}</ul> : null}
            {proposal.status === 'pending' && proposal.isCurrent ? (
              <div className="ux-decision-form">
                <textarea rows={2} aria-label="判断理由" value={rationales[proposal.id] ?? ''} onChange={(event) => setRationales((current) => ({ ...current, [proposal.id]: event.target.value }))} placeholder="判断理由（判断蓄積の適用条件になります）" />
                <div>{(['accept', 'reject', 'revise', 'split', 'merge'] as ProposalDecisionAction[]).map((action) => <button key={action} type="button" className={action === 'accept' ? 'primary' : 'ghost'} disabled={isDeciding || !(rationales[proposal.id]?.trim())} onClick={() => onDecide(proposal, action, rationales[proposal.id]?.trim() ?? '', action === 'reject' ? [] : (boundaryDrafts[proposal.id] ?? [proposalBoundary(proposal)]))}>{actionLabels[action]}</button>)}</div>
              </div>
            ) : null}
          </article>
        ))}
        {proposals.length === 0 ? <p className="muted">use case を記述して解析すると、ここに境界案が表示されます。</p> : null}
      </div>
      {decisions.length > 0 ? <div className="ux-decision-history"><h4>判断履歴（過去解析を含む）</h4>{decisions.map((decision) => <article key={decision.id}><strong>{actionLabels[decision.action]}</strong><span>{decision.rationale}</span><small>{currentProposalIds.has(decision.proposalId) ? '最新解析' : '旧解析'} · Genius 保存: {decision.geniusPublishStatus ?? 'not_requested'}{decision.geniusError ? ` (${decision.geniusError})` : ''}</small></article>)}</div> : null}
    </section>
  );
}
