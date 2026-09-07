import { req } from './api.ts';

export type EvidenceStatus = 'unverified' | 'candidate' | 'verified' | 'stale' | 'failed';
export type ProposalDecisionAction = 'accept' | 'reject' | 'revise' | 'split' | 'merge';

export interface UxScenario {
  id: string;
  projectId: string;
  name: string;
  actor: string;
  context: string;
  goal: string;
  successOutcome: string;
  sourceProjectKey: string | null;
  sourceRefs: string[];
  status: 'draft' | 'reviewed';
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface UxUseCase {
  id: string;
  scenarioId: string;
  title: string;
  userIntent: string;
  trigger: string;
  preconditions: string[];
  successOutcome: string;
  failureOutcomes: string[];
  interruptionRecovery: string;
  ordinal: number;
  revision: number;
}

export interface BoundaryDefinition {
  name: string;
  responsibility: string;
  classification: 'core' | 'supporting' | 'generic';
  in_scope: string[];
  out_of_scope: string[];
  rules: string[];
  ubiquitous_language: string[];
  interactions: string[];
  use_case_ids: string[];
}

export interface BoundaryProposal {
  id: string;
  analysisId: string;
  scenarioId: string;
  useCaseIds: string[];
  name: string;
  purpose: string;
  classification: 'core' | 'supporting' | 'generic';
  responsibilities: string[];
  businessRules: string[];
  inScope: string[];
  outOfScope: string[];
  collaborations: string[];
  assumptions: string[];
  unresolvedQuestions: string[];
  alternatives: string[];
  existingDomainRefs: string[];
  geniusAssessments: Array<{ card_id: string; applicability: string; rationale: string }>;
  humanQuestions: string[];
  rationale: string;
  confidence: number | null;
  status: 'pending' | 'accepted' | 'rejected' | 'externalized';
  revision: number;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
}

export interface GeniusCardReference {
  card_id: string;
  title: string;
  applicability: string;
  source_revision: string | null;
}

export interface BoundaryDecision {
  id: string;
  proposalId: string;
  action: ProposalDecisionAction;
  rationale: string;
  resultBoundaries: BoundaryDefinition[];
  createdAt: string;
  decidedBy: string;
  geniusPublishStatus?: 'not_requested' | 'publishing' | 'published' | 'failed';
  geniusCardId?: string | null;
  geniusError?: string | null;
}

export interface UxAnalysis {
  id: string;
  scenarioId: string;
  scenarioRevision: number;
  useCaseIds: string[];
  note: string | null;
  visibility: 'public' | 'sensitive';
  status: 'running' | 'completed' | 'error';
  anatomiaSourceRevision: string | null;
  geniusQuery: { text: string; cards: Array<{ id: string; situation: string; judgment: string; rationale: string; confidence: number; score: number | null; sourceRef: string | null }> } | null;
  errorCode: string | null;
  requestedBy: string;
  createdAt: string;
  completedAt: string | null;
}

export interface WorkspaceEvidence {
  id: string;
  scenarioId: string;
  targetKind: 'scenario' | 'use_case' | 'proposal';
  targetId: string;
  kind: 'implementation' | 'test' | 'anatomia' | 'manual';
  sourceProjectKey: string;
  sourceRevision: string;
  sourceRef: string;
  status: string;
  scenarioRevision: number;
  useCaseRevision: number | null;
  canvasRevision: number | null;
  payload: Record<string, unknown>;
  isStale: boolean;
  recordedAt: string;
}

export interface ImplementationEvidence {
  id: string;
  use_case_id: string;
  repository: string;
  revision: string;
  stable_ref: string;
  path: string;
  symbol: string | null;
  rationale: string;
  status: EvidenceStatus;
  observed_at: string;
}

export interface VerificationEvidence {
  id: string;
  use_case_id: string;
  specification_revision: number;
  implementation_revision: string | null;
  environment: string;
  result: 'not-run' | 'passed' | 'failed' | 'skipped' | 'stale';
  evidence_url: string | null;
  observed_at: string;
}

export interface CanvasFrame {
  id: string;
  name: string;
  description: string;
  states: Array<{ id: string; name: string; condition: string; content: string }>;
  x: number;
  y: number;
  width: number;
  height: number;
  viewport: { width: number; height: number };
}

export interface CanvasElement {
  id: string;
  frame_id: string;
  kind: 'box' | 'text' | 'button' | 'input' | 'image' | 'list';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sample_text: string | null;
  dynamic: { enabled: boolean; source: string | null; update_condition: string | null } | null;
  follow: { target_element_id: string; condition: string } | null;
}

export interface CanvasTransition {
  id: string;
  from: { frame_id: string; element_id: string | null };
  to_frame_id: string;
  trigger: string;
  label: string;
}

export interface UxCanvasDocument {
  revision: number;
  frames: CanvasFrame[];
  elements: CanvasElement[];
  transitions: CanvasTransition[];
}

export interface UxWorkspace {
  scenario: UxScenario;
  useCases: UxUseCase[];
  latestAnalysis: UxAnalysis | null;
  proposals: BoundaryProposal[];
  decisions: BoundaryDecision[];
  evidence: WorkspaceEvidence[];
  canvas: UxCanvasDocument;
}

export interface ImageLayoutCandidate {
  id: string;
  label: string;
  confidence: number;
  frame: CanvasFrame;
  elements: CanvasElement[];
  notes: string[];
}

export interface ImageLayoutAnalysis {
  analysis: { id: string; baseCanvasRevision: number; imageFingerprint: string; status: 'running' | 'completed' | 'error' };
  candidates: ImageLayoutCandidate[];
}

const root = (projectId: string) => `/api/projects/${projectId}/ux-design`;

export const uxDesignApi = {
  listScenarios: (projectId: string) => req<{ items: UxScenario[] }>(`${root(projectId)}/scenarios`),
  createScenario: (
    projectId: string,
    body: Pick<UxScenario, 'name' | 'actor' | 'context' | 'goal' | 'successOutcome' | 'sourceProjectKey' | 'sourceRefs'>,
  ) => req<{ scenario: UxScenario }>(`${root(projectId)}/scenarios`, { method: 'POST', body: JSON.stringify(body) }),
  updateScenario: (projectId: string, scenarioId: string, body: Partial<Pick<UxScenario, 'name' | 'actor' | 'context' | 'goal' | 'successOutcome' | 'sourceProjectKey' | 'sourceRefs' | 'status'>> & { expectedRevision: number }) =>
    req<{ scenario: UxScenario }>(`${root(projectId)}/scenarios/${scenarioId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getWorkspace: (projectId: string, scenarioId: string) =>
    req<{ workspace: UxWorkspace }>(`${root(projectId)}/scenarios/${scenarioId}/workspace`),
  createUseCase: (
    projectId: string,
    scenarioId: string,
    body: Omit<UxUseCase, 'id' | 'scenarioId' | 'revision'>,
  ) => req<{ use_case: UxUseCase }>(`${root(projectId)}/scenarios/${scenarioId}/use-cases`, {
    method: 'POST', body: JSON.stringify(body),
  }),
  updateUseCase: (projectId: string, scenarioId: string, useCaseId: string, body: Partial<Omit<UxUseCase, 'id' | 'scenarioId' | 'revision'>> & { expectedRevision: number }) =>
    req<{ useCase: UxUseCase }>(`${root(projectId)}/scenarios/${scenarioId}/use-cases/${useCaseId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  analyze: (
    projectId: string,
    scenarioId: string,
    body: { expected_revision: number; use_case_ids?: string[]; note?: string; visibility: 'public' | 'sensitive' },
  ) => req<{ analysis: UxAnalysis; proposals: BoundaryProposal[] }>(`${root(projectId)}/scenarios/${scenarioId}/analysis`, {
    method: 'POST', body: JSON.stringify(body),
  }),
  decideProposal: (
    projectId: string,
    scenarioId: string,
    proposalId: string,
    body: { action: ProposalDecisionAction; expected_proposal_revision: number; rationale: string; result_boundaries: BoundaryDefinition[] },
  ) => req<{ decision: BoundaryDecision; proposal: BoundaryProposal }>(
    `${root(projectId)}/scenarios/${scenarioId}/proposals/${proposalId}/decisions`,
    { method: 'POST', body: JSON.stringify(body) },
  ),
  saveCanvas: (projectId: string, scenarioId: string, canvas: UxCanvasDocument) =>
    req<{ canvas: UxCanvasDocument }>(`${root(projectId)}/scenarios/${scenarioId}/canvas`, {
      method: 'PUT',
      body: JSON.stringify({ expected_revision: canvas.revision, frames: canvas.frames, elements: canvas.elements, transitions: canvas.transitions }),
    }),
  analyzeImage: (projectId: string, scenarioId: string, image: File, expectedCanvasRevision: number) => {
    const body = new FormData();
    body.set('image', image);
    body.set('expected_canvas_revision', String(expectedCanvasRevision));
    return req<ImageLayoutAnalysis>(`${root(projectId)}/scenarios/${scenarioId}/canvas/image-analysis`, { method: 'POST', body });
  },
  applyImageCandidates: (
    projectId: string,
    scenarioId: string,
    analysisId: string,
    expectedCanvasRevision: number,
    candidateIds: string[],
  ) => req<{ canvas: UxCanvasDocument }>(
    `${root(projectId)}/scenarios/${scenarioId}/canvas/image-analysis/${analysisId}/apply`,
    { method: 'POST', body: JSON.stringify({ expected_canvas_revision: expectedCanvasRevision, candidate_ids: candidateIds }) },
  ),
  createEvidence: (
    projectId: string,
    scenarioId: string,
    body: Omit<WorkspaceEvidence, 'id' | 'scenarioId' | 'scenarioRevision' | 'useCaseRevision' | 'canvasRevision' | 'isStale' | 'recordedAt'> & {
      expectedScenarioRevision: number; expectedUseCaseRevision?: number; expectedCanvasRevision?: number;
    },
  ) => req<{ evidence: WorkspaceEvidence }>(`${root(projectId)}/scenarios/${scenarioId}/evidence`, { method: 'POST', body: JSON.stringify(body) }),
  fetchAnatomiaEvidence: (projectId: string, scenarioId: string, proposalId: string, expectedProposalRevision: number, query: string) =>
    req<{ evidence: WorkspaceEvidence }>(`${root(projectId)}/scenarios/${scenarioId}/proposals/${proposalId}/anatomia-evidence`, {
      method: 'POST', body: JSON.stringify({ expectedProposalRevision, query }),
    }),
};
