// Anatomia ドメイン正本の読み取り + Praeforma ドメインとの突合 (feature/screen-flow.md §4.1)。
//
//   - ドメイン情報は Anatomia に集約される = Anatomia が必ず正本 (neco 2026-08-22)。
//     Praeforma は `GET {anatomiaUrl}/api/projects/:id/domain-view` を読み取り専用で参照する。
//   - Thaleia(MUSA) は仕様↔コードの突合のみ。 ドメイン配布は経由しない。
//   - 未設定なら mock に落とさず明示エラー (anatomia_unconfigured)。
//
// @spec 4.1 正本と突合

import { AppError } from './errors.ts';

const DEFAULT_TIMEOUT_MS = 15_000;
/** Anatomia project id / repo 名として受け付ける形 (外部へそのまま渡るので制限)。 */
export const ANATOMIA_REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/;

export interface AnatomiaDomainsOptions {
  anatomiaUrl: string | null;
}

/** Anatomia domain-view の 1 ドメイン (必要な項目だけ)。 */
export interface AnatomiaDomain {
  name: string;
  description: string | null;
  implementorCount: number;
}

interface DomainViewPayload {
  views?: Array<{ domain?: unknown; description?: unknown; implementorCount?: unknown }>;
}

export async function fetchAnatomiaDomains(
  opts: AnatomiaDomainsOptions,
  repo: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<AnatomiaDomain[]> {
  if (!opts.anatomiaUrl) throw new AppError('anatomia_unconfigured', 503);
  if (!ANATOMIA_REPO_PATTERN.test(repo)) throw AppError.badRequest('bad_anatomia_repo');
  const url = `${opts.anatomiaUrl.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(repo)}/domain-view`;
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
  const payload = (await res.json().catch(() => null)) as DomainViewPayload | null;
  if (!payload || !Array.isArray(payload.views)) {
    throw new AppError('anatomia_bad_payload', 502);
  }
  return payload.views
    .filter((v) => typeof v.domain === 'string' && v.domain.length > 0)
    .map((v) => ({
      name: v.domain as string,
      description: typeof v.description === 'string' ? v.description : null,
      implementorCount: typeof v.implementorCount === 'number' ? v.implementorCount : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface MatchResult {
  /** 同名 (case-insensitive) で確定した Anatomia ドメイン名。 */
  exact: string | null;
  /** 確定できない時の候補 (名前の部分一致 / description に名前を含む)。 先頭が最有力。 */
  candidates: string[];
}

/** Praeforma ドメイン名を Anatomia 一覧と突合する。 純関数 (テスト対象)。 */
export function matchDomain(name: string, catalog: readonly AnatomiaDomain[]): MatchResult {
  const needle = name.trim().toLowerCase();
  if (!needle) return { exact: null, candidates: [] };
  const exact = catalog.find((d) => d.name.toLowerCase() === needle);
  if (exact) return { exact: exact.name, candidates: [] };
  const normalized = needle.replace(/[\s_]+/g, '-');
  const scored = catalog
    .map((d) => {
      const dn = d.name.toLowerCase();
      let score = 0;
      if (dn === normalized) score = 100;
      else if (dn.includes(normalized) || normalized.includes(dn)) score = 50;
      else if (d.description && d.description.toLowerCase().includes(needle)) score = 20;
      return { name: d.name, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  if (scored[0]?.score === 100) return { exact: scored[0].name, candidates: [] };
  return { exact: null, candidates: scored.slice(0, 5).map((s) => s.name) };
}
