import React from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '../lib/api.ts';
import {
  uxDesignApi,
  type BoundaryDefinition,
  type BoundaryProposal,
  type ImageLayoutAnalysis,
  type ProposalDecisionAction,
  type UxCanvasDocument,
  type UxScenario,
  type UxUseCase,
  type UxWorkspace,
} from '../lib/ux-design-api.ts';
import { BoundaryPanel } from '../components/ux-design/BoundaryPanel.tsx';
import { DesignCanvas } from '../components/ux-design/DesignCanvas.tsx';
import { EvidencePanel } from '../components/ux-design/EvidencePanel.tsx';
import type { EvidenceDraft } from '../components/ux-design/EvidencePanel.tsx';
import { ImageImportPanel } from '../components/ux-design/ImageImportPanel.tsx';
import { UseCasePanel } from '../components/ux-design/UseCasePanel.tsx';
import { ScenarioSummary } from '../components/ux-design/ScenarioSummary.tsx';
import { useCanvasHistory } from '../components/ux-design/useCanvasHistory.ts';

type WorkspaceTab = 'canvas' | 'boundaries' | 'evidence';
const emptyCanvas: UxCanvasDocument = { revision: 0, frames: [], elements: [], transitions: [] };

function errorText(error: unknown): string {
  const apiError = error as ApiError;
  const body = apiError.body as { error?: string; message?: string } | undefined;
  if (apiError.status === 409) return '別の編集が保存されています。再読込して差分を確認してください。';
  return body?.message ?? body?.error ?? (error instanceof Error ? error.message : '処理に失敗しました');
}

function draftKey(projectId: string, scenarioId: string): string {
  return `praeforma.ux-canvas.${projectId}.${scenarioId}`;
}

/**
 * 保存前の下書きは、 server が先に進んでいても捨てない。 revision がずれている場合は
 * 下書きを載せたまま返し、 呼び出し側の revision 不一致バナーで採用版を人間に選ばせる。
 * ここで server 版へ黙って倒すと、 再読込しただけで未保存の編集が消える。
 */
function recoverDraft(projectId: string, scenarioId: string, serverCanvas: UxCanvasDocument): UxCanvasDocument {
  try {
    const raw = localStorage.getItem(draftKey(projectId, scenarioId));
    if (!raw) return serverCanvas;
    const draft = JSON.parse(raw) as UxCanvasDocument;
    if (typeof draft?.revision !== 'number' || !Array.isArray(draft.frames)
      || !Array.isArray(draft.elements) || !Array.isArray(draft.transitions)) {
      return serverCanvas;
    }
    return draft;
  } catch {
    return serverCanvas;
  }
}

interface WorkspaceEditorProps {
  projectId: string;
  workspace: UxWorkspace;
  onReload: () => void;
}

function WorkspaceEditor({ projectId, workspace, onReload }: WorkspaceEditorProps): React.ReactElement {
  const initialCanvas = React.useMemo(() => recoverDraft(projectId, workspace.scenario.id, workspace.canvas), [projectId, workspace.scenario.id, workspace.canvas]);
  const [tab, setTab] = React.useState<WorkspaceTab>('canvas');
  const [isDirty, setDirty] = React.useState(() => JSON.stringify(initialCanvas) !== JSON.stringify(workspace.canvas));
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [imageResult, setImageResult] = React.useState<ImageLayoutAnalysis | null>(null);
  const history = useCanvasHistory(initialCanvas);
  const latestCanvasRef = React.useRef(history.canvas);
  latestCanvasRef.current = history.canvas;
  const storageKey = draftKey(projectId, workspace.scenario.id);

  React.useEffect(() => {
    if (!isDirty) return;
    localStorage.setItem(storageKey, JSON.stringify(history.canvas));
  }, [history.canvas, isDirty, storageKey]);
  React.useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (isDirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);
  React.useEffect(() => {
    if (workspace.canvas.revision === history.canvas.revision) return;
    if (isDirty) setMessage({ kind: 'error', text: `サーバは canvas r${workspace.canvas.revision}、ローカル下書きは r${history.canvas.revision} です。採用する版を選んでください。` });
    else history.reset(workspace.canvas);
  }, [workspace.canvas.revision]);

  const saveCanvasM = useMutation({
    mutationFn: (submitted: UxCanvasDocument) => uxDesignApi.saveCanvas(projectId, workspace.scenario.id, submitted),
    onSuccess: ({ canvas }, submitted) => {
      const changedWhileSaving = latestCanvasRef.current !== submitted;
      history.reset(changedWhileSaving ? { ...latestCanvasRef.current, revision: canvas.revision } : canvas);
      setDirty(changedWhileSaving);
      if (!changedWhileSaving) localStorage.removeItem(storageKey);
      setMessage({ kind: 'ok', text: `キャンバス r${canvas.revision} を保存しました` });
      onReload();
    },
    onError: (error) => setMessage({ kind: 'error', text: errorText(error) }),
  });
  const analysisM = useMutation({
    mutationFn: (body: { note: string; visibility: 'public' | 'sensitive' }) => uxDesignApi.analyze(projectId, workspace.scenario.id, {
      expected_revision: workspace.scenario.revision, note: body.note || undefined, visibility: body.visibility,
    }),
    onSuccess: () => { setMessage({ kind: 'ok', text: '境界案を保存しました' }); onReload(); },
    onError: (error) => setMessage({ kind: 'error', text: errorText(error) }),
  });
  const createUseCaseM = useMutation({
    mutationFn: (draft: Parameters<typeof uxDesignApi.createUseCase>[2]) => uxDesignApi.createUseCase(projectId, workspace.scenario.id, draft),
    onSuccess: () => { setMessage({ kind: 'ok', text: 'use case を保存しました' }); onReload(); },
    onError: (error) => setMessage({ kind: 'error', text: errorText(error) }),
  });
  const updateUseCaseM = useMutation({
    mutationFn: ({ useCase, draft }: { useCase: UxWorkspace['useCases'][number]; draft: Omit<UxUseCase, 'id' | 'scenarioId' | 'revision'> }) => uxDesignApi.updateUseCase(projectId, workspace.scenario.id, useCase.id, { ...draft, expectedRevision: useCase.revision }),
    onSuccess: () => { setMessage({ kind: 'ok', text: 'use case を更新しました。既存の根拠は再確認対象になります。' }); onReload(); },
    onError: (error) => setMessage({ kind: 'error', text: errorText(error) }),
  });
  const updateScenarioM = useMutation({
    mutationFn: (fields: Partial<UxWorkspace['scenario']>) => uxDesignApi.updateScenario(projectId, workspace.scenario.id, { ...fields, expectedRevision: workspace.scenario.revision }),
    onSuccess: () => { setMessage({ kind: 'ok', text: 'シナリオを更新しました。既存の根拠は再確認対象になります。' }); onReload(); },
    onError: (error) => setMessage({ kind: 'error', text: errorText(error) }),
  });
  const decisionM = useMutation({
    mutationFn: (input: { proposal: BoundaryProposal; action: ProposalDecisionAction; rationale: string; boundaries: BoundaryDefinition[] }) =>
      uxDesignApi.decideProposal(projectId, workspace.scenario.id, input.proposal.id, {
        action: input.action, expected_proposal_revision: input.proposal.revision,
        rationale: input.rationale, result_boundaries: input.boundaries,
      }),
    onSuccess: () => { setMessage({ kind: 'ok', text: '判断と理由を記録しました' }); onReload(); },
    onError: (error) => setMessage({ kind: 'error', text: errorText(error) }),
  });
  const evidenceM = useMutation({
    mutationFn: (draft: EvidenceDraft) => {
      const useCase = draft.targetKind === 'use_case' ? workspace.useCases.find((item) => item.id === draft.targetId) : undefined;
      return uxDesignApi.createEvidence(projectId, workspace.scenario.id, {
        ...draft, payload: {}, expectedScenarioRevision: workspace.scenario.revision,
        expectedUseCaseRevision: useCase?.revision, expectedCanvasRevision: workspace.canvas.revision,
      });
    },
    onSuccess: () => { setMessage({ kind: 'ok', text: '根拠を登録しました' }); onReload(); },
    onError: (error) => setMessage({ kind: 'error', text: errorText(error) }),
  });
  const anatomiaEvidenceM = useMutation({
    mutationFn: ({ proposal, query }: { proposal: BoundaryProposal; query: string }) => uxDesignApi.fetchAnatomiaEvidence(projectId, workspace.scenario.id, proposal.id, proposal.revision, query),
    onSuccess: () => { setMessage({ kind: 'ok', text: 'Anatomia の実装根拠を登録しました' }); onReload(); },
    onError: (error) => setMessage({ kind: 'error', text: errorText(error) }),
  });
  const imageM = useMutation({
    mutationFn: (file: File) => uxDesignApi.analyzeImage(projectId, workspace.scenario.id, file, history.canvas.revision),
    onSuccess: setImageResult,
    onError: (error) => setMessage({ kind: 'error', text: errorText(error) }),
  });
  const applyImageM = useMutation({
    mutationFn: (ids: string[]) => uxDesignApi.applyImageCandidates(projectId, workspace.scenario.id, imageResult!.analysis.id, history.canvas.revision, ids),
    onSuccess: ({ canvas }) => { history.reset(canvas); setDirty(false); setImageResult(null); localStorage.removeItem(storageKey); setMessage({ kind: 'ok', text: '選択したレイアウト案を追加しました' }); onReload(); },
    onError: (error) => setMessage({ kind: 'error', text: errorText(error) }),
  });

  return (
    <div className="ux-workspace-main">
      <ScenarioSummary scenario={workspace.scenario} isSaving={updateScenarioM.isPending} onUpdate={(fields) => updateScenarioM.mutate(fields)} />
      <UseCasePanel useCases={workspace.useCases} isSaving={createUseCaseM.isPending || updateUseCaseM.isPending} onCreate={(draft) => createUseCaseM.mutate(draft)} onUpdate={(useCase, draft) => updateUseCaseM.mutate({ useCase, draft })} />
      <nav className="ux-workspace-tabs" aria-label="設計ビュー">
        {([['canvas', '画面・遷移'], ['boundaries', '境界レビュー'], ['evidence', '実装・検証']] as Array<[WorkspaceTab, string]>).map(([value, label]) => <button key={value} type="button" className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}
      </nav>
      {message ? <div className={`ux-message ${message.kind}`} role="status">{message.text}{message.kind === 'error' ? <button type="button" onClick={onReload}>最新状態を取得</button> : null}{workspace.canvas.revision !== history.canvas.revision ? <><button type="button" onClick={() => { history.reset(workspace.canvas); setDirty(false); localStorage.removeItem(storageKey); setMessage({ kind: 'ok', text: 'サーバ版を採用しました' }); }}>サーバ版を採用</button><button type="button" onClick={() => { history.reset({ ...history.canvas, revision: workspace.canvas.revision }); setDirty(true); setMessage({ kind: 'ok', text: 'ローカル下書きを最新 revision に載せ替えました。内容を確認して保存してください。' }); }}>ローカル案を載せ替え</button></> : null}</div> : null}
      {tab === 'canvas' ? <>
        <ImageImportPanel result={imageResult} isAnalyzing={imageM.isPending} isApplying={applyImageM.isPending} isDisabled={isDirty} onAnalyze={(file) => imageM.mutate(file)} onApply={(ids) => applyImageM.mutate(ids)} />
        <DesignCanvas canvas={history.canvas} onPreview={history.preview} onCancelPreview={history.cancelPreview} onChange={(next) => { history.replace(next); setDirty(true); }} onUndo={history.undo} onRedo={history.redo} canUndo={history.canUndo} canRedo={history.canRedo} onSave={() => saveCanvasM.mutate(history.canvas)} isSaving={saveCanvasM.isPending} isReadOnly={applyImageM.isPending} />
      </> : null}
      {tab === 'boundaries' ? <BoundaryPanel proposals={workspace.proposals} decisions={workspace.decisions} analysis={workspace.latestAnalysis} useCases={workspace.useCases} isAnalyzing={analysisM.isPending} isDeciding={decisionM.isPending} onAnalyze={(note, visibility) => analysisM.mutate({ note, visibility })} onDecide={(proposal, action, rationale, boundaries) => decisionM.mutate({ proposal, action, rationale, boundaries })} onFetchAnatomia={(proposal, query) => anatomiaEvidenceM.mutate({ proposal, query })} isFetchingAnatomia={anatomiaEvidenceM.isPending} /> : null}
      {tab === 'evidence' ? <EvidencePanel scenarioId={workspace.scenario.id} useCases={workspace.useCases} evidence={workspace.evidence} isSaving={evidenceM.isPending} onCreate={(draft) => evidenceM.mutate(draft)} /> : null}
    </div>
  );
}

export function UxCoreDesignPage(): React.ReactElement {
  const { pid = '' } = useParams();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [scenarioDraft, setScenarioDraft] = React.useState({ name: '', actor: '', context: '', goal: '', successOutcome: '', sourceProjectKey: '', sourceRefs: [] as string[] });

  const projectQ = useQuery({ queryKey: ['project', pid], queryFn: () => api.getProject(pid), enabled: !!pid });
  const scenariosQ = useQuery({ queryKey: ['ux-scenarios', pid], queryFn: () => uxDesignApi.listScenarios(pid), enabled: !!pid });
  const activeId = selectedId ?? scenariosQ.data?.items[0]?.id ?? null;
  const workspaceQ = useQuery({ queryKey: ['ux-workspace', pid, activeId], queryFn: () => uxDesignApi.getWorkspace(pid, activeId as string), enabled: !!pid && !!activeId });
  const createScenarioM = useMutation({
    mutationFn: () => uxDesignApi.createScenario(pid, { ...scenarioDraft, sourceProjectKey: scenarioDraft.sourceProjectKey || null }),
    onSuccess: ({ scenario }) => { setSelectedId(scenario.id); setShowCreate(false); setScenarioDraft({ name: '', actor: '', context: '', goal: '', successOutcome: '', sourceProjectKey: '', sourceRefs: [] }); queryClient.invalidateQueries({ queryKey: ['ux-scenarios', pid] }); },
  });

  if (!pid) return <p>missing project id</p>;
  const projectName = projectQ.data?.project.name ?? 'Praeforma';

  return (
    <div className="ux-design-page">
      <header className="ux-page-header"><div><Link to={`/projects/${pid}`}>← {projectName}</Link><h1>UX / Core Domain Design</h1><p>体験から use case を定義し、責務と境界を設計します。非コアドメインは Anatomia が管理します。</p></div>{workspaceQ.data?.workspace.scenario.sourceProjectKey ? <span className="ux-project-chip">Source: {workspaceQ.data.workspace.scenario.sourceProjectKey}</span> : null}</header>
      <div className="ux-design-shell">
        <aside className="ux-scenario-rail">
          <div className="ux-section-heading"><h2>シナリオ</h2><button type="button" className="ghost" onClick={() => setShowCreate((value) => !value)}>＋</button></div>
          {showCreate ? <form className="foundation-form ux-create-scenario" onSubmit={(event) => { event.preventDefault(); createScenarioM.mutate(); }}>
            {([['name', 'シナリオ名'], ['actor', '誰が'], ['context', 'どんな状況で'], ['goal', '何を達成する'], ['successOutcome', '成功条件'], ['sourceProjectKey', '題材プロジェクト (例: Mp)']] as const).map(([key, label]) => <label key={key} className="simple-field"><span>{label}</span><input required={key !== 'sourceProjectKey'} value={scenarioDraft[key]} onChange={(event) => setScenarioDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
            <button className="primary" type="submit" disabled={createScenarioM.isPending}>作成</button>
            {createScenarioM.isError ? <span className="error">{errorText(createScenarioM.error)}</span> : null}
          </form> : null}
          {scenariosQ.isError ? <p className="error">{errorText(scenariosQ.error)}</p> : null}
          <div className="ux-scenario-list">{scenariosQ.data?.items.map((scenario: UxScenario) => <button key={scenario.id} type="button" className={activeId === scenario.id ? 'active' : ''} onClick={() => setSelectedId(scenario.id)}><strong>{scenario.name}</strong><span>{scenario.actor} · {scenario.status} · r{scenario.revision}</span></button>)}{scenariosQ.isSuccess && scenariosQ.data.items.length === 0 ? <p className="muted">最初の UX シナリオを作成してください。</p> : null}</div>
          <div className="ux-principle"><strong>境界の原則</strong><p>画面や scene に domain を割り当てません。UX シナリオと use case の業務ルールから境界を判断します。</p></div>
        </aside>
        {workspaceQ.data ? <WorkspaceEditor key={`${pid}:${workspaceQ.data.workspace.scenario.id}`} projectId={pid} workspace={workspaceQ.data.workspace} onReload={() => queryClient.invalidateQueries({ queryKey: ['ux-workspace', pid, activeId] })} /> : <main className="ux-workspace-empty">{workspaceQ.isError ? <p className="error">{errorText(workspaceQ.error)}</p> : <p>{activeId ? '設計データを読み込み中…' : 'シナリオを選択してください'}</p>}</main>}
      </div>
    </div>
  );
}
