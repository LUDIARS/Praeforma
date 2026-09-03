import { AppError } from '../errors.ts';
import { selectAnatomiaGraph } from './select.ts';
import type { AnatomiaGraph, GraphTarget, SelectedGraph } from './types.ts';

const DEFAULT_TIMEOUT_MS = 15_000;

export interface AnatomiaGraphOptions {
  baseUrl: string | null;
  token: string | null;
}

function headers(token: string | null): Record<string, string> {
  return token ? { accept: 'application/json', authorization: `Bearer ${token}` } : { accept: 'application/json' };
}

async function getJson(
  baseUrl: string,
  token: string | null,
  path: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}${path}`, {
      headers: headers(token),
      signal: controller.signal,
    });
  } catch (error) {
    throw new AppError('anatomia_unreachable', 502, { reason: String(error) });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new AppError('anatomia_upstream_failed', 502, { status: response.status, path });
  try {
    return await response.json();
  } catch {
    throw new AppError('anatomia_bad_payload', 502);
  }
}

function parseGraph(value: unknown): AnatomiaGraph {
  if (!value || typeof value !== 'object') throw new AppError('anatomia_bad_payload', 502);
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    throw new AppError('anatomia_bad_payload', 502);
  }
  const nodes = raw.nodes.map((value) => {
    if (!value || typeof value !== 'object') throw new AppError('anatomia_bad_payload', 502);
    const node = value as Record<string, unknown>;
    const sourceRange = node.sourceRange;
    if (typeof node.id !== 'string' || typeof node.name !== 'string' || typeof node.kind !== 'string') {
      throw new AppError('anatomia_bad_payload', 502);
    }
    const filePath = sourceRange && typeof sourceRange === 'object'
      ? (sourceRange as Record<string, unknown>).filePath
      : undefined;
    const path = typeof filePath === 'string' ? filePath : '';
    return { id: node.id, name: node.name, kind: node.kind, path };
  });
  const edges = raw.edges.map((value) => {
    if (!value || typeof value !== 'object') throw new AppError('anatomia_bad_payload', 502);
    const edge = value as Record<string, unknown>;
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string' || typeof edge.kind !== 'string') {
      throw new AppError('anatomia_bad_payload', 502);
    }
    return { from: edge.from, to: edge.to, kind: edge.kind };
  });
  return { nodes, edges };
}

function parseImplementors(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') throw new AppError('anatomia_bad_payload', 502);
  const views = (value as Record<string, unknown>).views;
  if (!Array.isArray(views)) throw new AppError('anatomia_bad_payload', 502);
  const entries: Array<[string, string[]]> = [];
  for (const value of views) {
    if (!value || typeof value !== 'object') throw new AppError('anatomia_bad_payload', 502);
    const view = value as Record<string, unknown>;
    const implementors = view.implementors ?? [];
    if (typeof view.domain !== 'string' || !Array.isArray(implementors)
      || !implementors.every((item) => typeof item === 'string')) {
      throw new AppError('anatomia_bad_payload', 502);
    }
    entries.push([view.domain, implementors as string[]]);
  }
  return Object.fromEntries(entries);
}

/** Fetches Anatomia's source graph and normalizes it for Studio without an intermediary service. */
export async function fetchStudioGraph(
  options: AnatomiaGraphOptions,
  project: string,
  target: GraphTarget,
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<SelectedGraph> {
  if (!options.baseUrl) {
    throw new AppError('anatomia_unconfigured', 503, {
      hint: 'PRAEFORMA_ANATOMIA_URL を設定すると Studio の関連処理グラフを取得できます。',
    });
  }
  const graph = parseGraph(await getJson(
    options.baseUrl,
    options.token,
    `/api/graph?project=${encodeURIComponent(project)}`,
    timeoutMs,
    fetchImpl,
  ));
  let implementorsByDomain: Record<string, string[]> = {};
  if (target.kind === 'domain') {
    implementorsByDomain = parseImplementors(await getJson(
      options.baseUrl,
      options.token,
      `/api/projects/${encodeURIComponent(project)}/domain-view`,
      timeoutMs,
      fetchImpl,
    ));
  }
  return selectAnatomiaGraph({ graph, implementorsByDomain, target, query });
}
