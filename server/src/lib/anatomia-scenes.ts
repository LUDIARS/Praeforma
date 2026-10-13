// Anatomia の解析シーンを Praeforma のシーン (layout) 登録候補にする (spec/feature/anatomia-scene-proposals.md)。
//
//   - 正本は Anatomia の canonical scene 解析 (`GET {anatomiaUrl}/api/projects/:id/scenes`)。Praeforma は
//     読み取り専用で参照し、利用者が確認・調整して明示的に登録したものだけを layout にする。
//   - 削除済み (tombstone) の解析シーンは候補に出さない。
//   - 登録済みの対応は layouts.anatomia_scene_id で持ち、再取得しても同じシーンを候補に戻さない
//     (候補には「登録済み」として layout id を添える)。
//   - 未設定・取得失敗・候補なし・解析が古い、を区別して返す。mock には落とさない。
//
// @spec Anatomia scene proposals

import { AppError } from './errors.ts';
import { ANATOMIA_REPO_PATTERN, type AnatomiaDomainsOptions } from './anatomia-domains.ts';

const DEFAULT_TIMEOUT_MS = 15_000;

/** 根拠として見せる解析元の位置 (Anatomia の SceneSourceAnchor の必要部分)。 */
export interface SceneProposalEvidence {
  path: string;
  start_line: number;
  end_line: number;
  detector: string;
  reason: string;
}

export interface SceneProposal {
  /** 解析元の CanonicalScene.id (登録時に layouts.anatomia_scene_id へ入る)。 */
  scene_id: string;
  label: string;
  kind: string;
  origin: string;
  /** 利用者が調整する前の、Praeforma の layout 種別の提案値。 */
  suggested_kind: 'ui-2d' | 'world-2d' | 'world-3d';
  evidence: SceneProposalEvidence | null;
  /** Anatomia 側で付けられた説明 (annotation)。無ければ null。 */
  description: string | null;
  /** 既に登録済みならその layout id。未登録は null。 */
  registered_layout_id: string | null;
}

export interface SceneProposalList {
  stale: boolean;
  stale_reasons: string[];
  proposals: SceneProposal[];
}

interface RawScene {
  id?: unknown;
  label?: unknown;
  kind?: unknown;
  origin?: unknown;
  tombstone?: unknown;
  sourceAnchor?: { path?: unknown; startLine?: unknown; endLine?: unknown; detector?: unknown; reason?: unknown } | null;
  annotation?: { label?: unknown; description?: unknown } | null;
}

interface RawScenesPayload {
  scenes?: RawScene[];
  /** Anatomia が単一 context で動くときの互換形 (manager モードでは scenes)。 */
  merged?: RawScene[];
  stale?: unknown;
  staleReasons?: unknown;
}

const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
const int = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0);

/** Anatomia のシーン種別から Praeforma の layout 種別を提案する (利用者が変更できる初期値)。 */
export function suggestLayoutKind(kind: string, origin: string): SceneProposal['suggested_kind'] {
  const k = kind.toLowerCase();
  if (/(3d|world|level|stage|map|field)/.test(k)) return /2d/.test(k) ? 'world-2d' : 'world-3d';
  if (origin === 'route' || /(screen|page|menu|ui|dialog|hud|title)/.test(k)) return 'ui-2d';
  return 'ui-2d';
}

/**
 * Anatomia の scenes 応答を候補一覧にする。純関数 (テスト対象)。
 * `registered` は anatomia_scene_id → layout id (既存の登録)。
 */
export function toSceneProposals(payload: unknown, registered: ReadonlyMap<string, string>): SceneProposalList {
  const body = (payload ?? {}) as RawScenesPayload;
  const scenes = Array.isArray(body.scenes) ? body.scenes : Array.isArray(body.merged) ? body.merged : null;
  if (!scenes) throw new AppError('anatomia_bad_payload', 502);
  const proposals: SceneProposal[] = [];
  const seen = new Set<string>();
  for (const scene of scenes) {
    const id = str(scene.id);
    if (!id || scene.tombstone === true || seen.has(id)) continue;
    seen.add(id);
    const kind = str(scene.kind) ?? 'scene';
    const origin = str(scene.origin) ?? 'static-code';
    const anchor = scene.sourceAnchor ?? null;
    const path = anchor ? str(anchor.path) : null;
    proposals.push({
      scene_id: id,
      label: str(scene.annotation?.label) ?? str(scene.label) ?? id,
      kind,
      origin,
      suggested_kind: suggestLayoutKind(kind, origin),
      evidence: anchor && path
        ? {
            path,
            start_line: int(anchor.startLine),
            end_line: int(anchor.endLine),
            detector: str(anchor.detector) ?? '',
            reason: str(anchor.reason) ?? '',
          }
        : null,
      description: str(scene.annotation?.description),
      registered_layout_id: registered.get(id) ?? null,
    });
  }
  proposals.sort((a, b) =>
    Number(a.registered_layout_id !== null) - Number(b.registered_layout_id !== null)
    || a.label.localeCompare(b.label, 'ja'));
  return {
    stale: body.stale === true,
    stale_reasons: Array.isArray(body.staleReasons) ? body.staleReasons.filter((r): r is string => typeof r === 'string') : [],
    proposals,
  };
}

/** Anatomia から canonical scene 解析を読む。未設定・到達不能・未登録を区別した AppError を投げる。 */
export async function fetchAnatomiaScenes(
  opts: AnatomiaDomainsOptions,
  repo: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  if (!opts.anatomiaUrl) throw new AppError('anatomia_unconfigured', 503);
  if (!ANATOMIA_REPO_PATTERN.test(repo)) throw AppError.badRequest('bad_anatomia_repo');
  const url = `${opts.anatomiaUrl.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(repo)}/scenes`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(url, { signal: ctrl.signal });
  } catch (e) {
    throw new AppError('anatomia_unreachable', 502, { reason: String(e) });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) throw AppError.notFound('anatomia_project_not_found');
  if (!res.ok) throw new AppError('anatomia_failed', 502, { status: res.status });
  const payload = await res.json().catch(() => null);
  if (!payload) throw new AppError('anatomia_bad_payload', 502);
  return payload;
}
