// Screen Flow の REST client (spec/feature/screen-flow.md §5.4 / §4.1 / §6)。
// 新 route は Drizzle の行をそのまま返すので camelCase で型付けする。
//
// @spec 5.4 API

import { getToken, type ApiError } from './api.ts';

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json, text/plain');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    const err = new Error(`HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return (await res.json()) as T;
}

async function text(path: string): Promise<string> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(path, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export interface Transition {
  id: string;
  projectId: string;
  fromLayoutId: string;
  sourceObjectId: string | null;
  toLayoutId: string;
  trigger: string;
  condition: string;
  label: string | null;
  ordinal: number;
  version: number;
}

export interface TransitionInput {
  from_layout_id: string;
  source_object_id?: string | null;
  to_layout_id: string;
  trigger?: string;
  condition?: string;
  label?: string | null;
  ordinal?: number;
}

export type ConversationTargetKind = 'project' | 'domain' | 'layout' | 'object' | 'transition';

/** `applied` はサーバが提案ごとに立てる反映済みフラグ (再読み込みしても残る)。 */
export type Proposal =
  // target はサーバ側で必須にしていない (紐づけ無しの要件も作れる)。 欠けうる前提で扱う。
  | { kind: 'spec'; target?: { kind: string; id: string }; title: string; description: string; priority?: string; category?: string; acceptance?: string[]; applied?: boolean }
  | { kind: 'transition'; from_layout_id: string; source_object_id: string | null; to_layout_id: string; trigger: string; condition?: string | null; label?: string | null; applied?: boolean }
  | { kind: 'object'; layout_id: string; widget: string; label: string; action?: string; applied?: boolean };

export interface Conversation {
  id: string;
  projectId: string;
  targetKind: ConversationTargetKind;
  targetId: string;
  title: string | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  proposals: Proposal[];
  applied: boolean;
  createdAt: string;
}

export interface TurnResult {
  userId: string;
  assistantId: string;
  content: string;
  proposals: Proposal[];
}

export interface ApplyResult {
  applied: Array<{ index: number; kind: Proposal['kind']; id: string }>;
  failed: { index: number; error: string } | null;
  /** 既に反映済みで今回は実行しなかった index。 */
  skipped: number[];
}

export interface AnatomiaDomainsResponse {
  repo: string;
  catalog: Array<{ name: string; description: string | null; implementorCount: number }>;
  matches: Array<{ domain_id: string; name: string; anatomia_domain: string | null; linked: boolean; exact: string | null; candidates: string[] }>;
}

export interface CcLink {
  id: string;
  targetKind: 'spec' | 'layout' | 'transition';
  targetId: string;
  ccKind: string;
  ccId: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  lastSyncedAt: string | null;
  createdAt: string;
}

/** server の lib/export/model.ts と同形。 */
export interface ExportModel {
  projectName: string;
  anatomiaRepo: string | null;
  screens: Array<{
    id: string;
    name: string;
    description: string | null;
    kind: string;
    domainName: string | null;
    anatomiaDomain: string | null;
    widgets: Array<{ placementId: string; objectId: string; name: string; widget: string | null; label: string | null; action: string | null; domainName: string | null }>;
    requirements: Array<{ code: string; title: string; description: string | null; priority: string; category: string; acceptance: string[] }>;
  }>;
  transitions: Array<{ id: string; fromLayoutId: string; toLayoutId: string; sourcePlacementId: string | null; trigger: string; condition: string; label: string | null; ordinal: number }>;
  domains: Array<{ id: string; name: string; description: string | null; anatomiaDomain: string | null }>;
  ccLinks: Array<{ targetKind: string; targetId: string; ccKind: string; ccId: string; status: string }>;
}

export const screenFlowApi = {
  // transitions
  listTransitions: (pid: string) => req<{ items: Transition[] }>(`/api/projects/${pid}/transitions`),
  createTransition: (pid: string, body: TransitionInput) =>
    req<{ transition: Transition }>(`/api/projects/${pid}/transitions`, { method: 'POST', body: JSON.stringify(body) }),
  updateTransition: (pid: string, tid: string, body: Partial<TransitionInput> & { version: number }) =>
    req<{ transition: Transition }>(`/api/projects/${pid}/transitions/${tid}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTransition: (pid: string, tid: string) =>
    req<{ ok: true }>(`/api/projects/${pid}/transitions/${tid}`, { method: 'DELETE' }),

  // export
  model: (pid: string) => req<ExportModel>(`/api/projects/${pid}/export/model.json`),
  flowMermaid: (pid: string, group: 'none' | 'domain' = 'none') =>
    text(`/api/projects/${pid}/export/flow.mmd?group=${group}`),
  specMarkdown: (pid: string) => text(`/api/projects/${pid}/export/spec.md`),

  // conversations
  getConversation: (pid: string, kind: ConversationTargetKind, id: string) =>
    req<{ conversation: Conversation | null; messages: ConversationMessage[] }>(
      `/api/projects/${pid}/conversations?target_kind=${kind}&target_id=${encodeURIComponent(id)}`,
    ),
  startConversation: (pid: string, body: { target_kind: ConversationTargetKind; target_id: string; message: string }) =>
    req<{ conversation: Conversation } & TurnResult>(`/api/projects/${pid}/conversations`, { method: 'POST', body: JSON.stringify(body) }),
  sendMessage: (pid: string, cid: string, message: string) =>
    req<TurnResult>(`/api/projects/${pid}/conversations/${cid}/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
  applyProposals: (pid: string, cid: string, mid: string, indices: number[]) =>
    req<ApplyResult>(`/api/projects/${pid}/conversations/${cid}/messages/${mid}/apply`, { method: 'POST', body: JSON.stringify({ indices }) }),

  // anatomia (正本)
  anatomiaDomains: (pid: string) => req<AnatomiaDomainsResponse>(`/api/projects/${pid}/anatomia/domains`),
  anatomiaMatch: (pid: string) =>
    req<{ linked: Array<{ domain_id: string; anatomia_domain: string }> }>(`/api/projects/${pid}/anatomia/match`, { method: 'POST' }),
  setDomainAnatomia: (pid: string, did: string, anatomia_domain: string | null) =>
    req<unknown>(`/api/projects/${pid}/domains/${did}`, { method: 'PATCH', body: JSON.stringify({ anatomia_domain }) }),
  setProjectAnatomiaRepo: (pid: string, anatomia_repo: string | null) =>
    req<unknown>(`/api/projects/${pid}`, { method: 'PATCH', body: JSON.stringify({ anatomia_repo }) }),

  // cc
  ccStatus: (pid: string) => req<{ configured: boolean; template: string | null; links: CcLink[] }>(`/api/projects/${pid}/cc/status`),
  ccSend: (pid: string, body: { target_kind: CcLink['targetKind']; target_id: string; note?: string }) =>
    req<{ link: CcLink; prompt_file_path: string | null }>(`/api/projects/${pid}/cc/send`, { method: 'POST', body: JSON.stringify(body) }),
  ccSync: (pid: string) => req<{ updated: number; links: CcLink[] }>(`/api/projects/${pid}/cc/sync`, { method: 'POST' }),
};

/** ApiError から表示用の短い文言を作る。 */
export function errorText(e: unknown): string {
  const err = e as ApiError;
  const body = err?.body as { error?: string } | null;
  return body?.error ?? err?.message ?? String(e);
}
