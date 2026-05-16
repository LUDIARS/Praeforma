// Praeforma backend REST client。 全リクエストに Bearer <PASETO> を付ける。
// vite が /api を backend に proxy するので origin は省略。

const TOKEN_KEY = 'praeforma.token';

export function getToken(): string | null {
  if (typeof location !== 'undefined' && location.hash.includes('token=')) {
    const m = location.hash.match(/token=([^&]+)/);
    if (m && m[1]) {
      const t = decodeURIComponent(m[1]);
      localStorage.setItem(TOKEN_KEY, t);
      history.replaceState(null, '', location.pathname + location.search);
      return t;
    }
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface ApiError extends Error {
  status?: number;
  body?: unknown;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    const err = new Error(`HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── types (server の DTO に対応) ──────────────────────────────────────────

export interface MeResponse {
  userId: string;
  displayName: string | null;
  role: string;
  projectKey: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  org_id: string;
  owner_user_id: string;
  platforms: string[];
  default_layout_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'planner' | 'designer' | 'programmer' | 'reviewer' | 'viewer';
  display_name: string | null;
  joined_at: string;
}

export interface Domain {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  parent_id: string | null;
  max_count: number | null;
  required_attrs: Array<{ name: string; type: string }>;
}

export interface PfObject {
  id: string;
  project_id: string;
  domain_id: string;
  label: string;
  placeholder_shape: string;
  placeholder_color: string;
  parent_object_id: string | null;
}

export interface Layout {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  kind: 'world-3d' | 'world-2d' | 'ui-2d';
  is_default: boolean;
}

export interface LayoutObject {
  id: string;
  layout_id: string;
  object_id: string;
  position: number[];
  rotation: number[];
  scale: number[];
  parent_layout_object_id: string | null;
  lock_transform: boolean;
  ordinal: number;
}

export interface Spec {
  id: string;
  project_id: string;
  code: string;
  title: string;
  description: string | null;
  priority: 'must' | 'should' | 'could' | 'wont';
  category: string;
  preconditions: string[];
  postconditions: string[];
  status: 'draft' | 'review' | 'approved' | 'obsolete';
  version: number;
}

export interface Reference {
  id: string;
  project_id: string;
  target_kind: string;
  target_id: string;
  kind: string;
  url: string;
  title: string;
  description: string | null;
  display_mode: 'link' | 'webview' | 'markdown';
  ordinal: number;
}

export interface Feedback {
  id: string;
  project_id: string;
  layout_id: string | null;
  object_id: string | null;
  layout_object_id: string | null;
  scene_path: string | null;
  world_position: number[] | null;
  screen_position: number[] | null;
  title: string;
  body: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  state: 'open' | 'in-progress' | 'resolved' | 'wont-fix';
  labels: string[];
  created_by: string;
  created_at: string;
}

// ── endpoints ─────────────────────────────────────────────────────────────

export const api = {
  me: () => req<MeResponse>('/api/auth/me'),

  // projects
  listProjects: () => req<{ items: Project[] }>('/api/projects'),
  getProject: (pid: string) => req<{ project: Project }>(`/api/projects/${pid}`),
  createProject: (body: { name: string; description?: string; org_id: string; platforms?: string[] }) =>
    req<{ project: Project }>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  listMembers: (pid: string) => req<{ items: ProjectMember[] }>(`/api/projects/${pid}/members`),

  // domains
  listDomains: (pid: string) => req<{ items: Domain[] }>(`/api/projects/${pid}/domains`),

  // objects
  listObjects: (pid: string) => req<{ items: PfObject[] }>(`/api/projects/${pid}/objects`),
  createObject: (pid: string, body: { domain_id: string; label: string }) =>
    req<{ object: PfObject }>(`/api/projects/${pid}/objects`, { method: 'POST', body: JSON.stringify(body) }),

  // layouts
  listLayouts: (pid: string) => req<{ items: Layout[] }>(`/api/projects/${pid}/layouts`),
  getLayout: (pid: string, lid: string) =>
    req<{ layout: Layout; layout_objects: LayoutObject[]; cameras: unknown[] }>(
      `/api/projects/${pid}/layouts/${lid}`,
    ),
  createLayout: (pid: string, body: { name: string }) =>
    req<{ layout: Layout }>(`/api/projects/${pid}/layouts`, { method: 'POST', body: JSON.stringify(body) }),
  putLayoutObjects: (pid: string, lid: string, items: Array<Partial<LayoutObject> & { object_id: string }>) =>
    req<{ layout_objects: LayoutObject[] }>(`/api/projects/${pid}/layouts/${lid}/objects`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),

  // specs
  listSpecs: (pid: string) => req<{ items: Spec[] }>(`/api/projects/${pid}/specs`),
  getSpec: (pid: string, sid: string) =>
    req<{ spec: Spec; targets: unknown[]; acceptance: unknown[] }>(`/api/projects/${pid}/specs/${sid}`),
  createSpec: (pid: string, body: { code: string; title: string; description?: string }) =>
    req<{ spec: Spec }>(`/api/projects/${pid}/specs`, { method: 'POST', body: JSON.stringify(body) }),

  // references
  listReferences: (pid: string, targetKind: string, targetId: string) =>
    req<{ items: Reference[] }>(
      `/api/projects/${pid}/references?target_kind=${encodeURIComponent(targetKind)}&target_id=${encodeURIComponent(targetId)}`,
    ),

  // feedback
  listFeedback: (pid: string, opts: { layout?: string; object?: string; layout_object?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.layout) q.set('layout', opts.layout);
    if (opts.object) q.set('object', opts.object);
    if (opts.layout_object) q.set('layout_object', opts.layout_object);
    return req<{ items: Feedback[] }>(`/api/projects/${pid}/feedback?${q.toString()}`);
  },
  createFeedback: (pid: string, body: Partial<Feedback> & { title: string }) =>
    req<{ feedback: Feedback }>(`/api/projects/${pid}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
