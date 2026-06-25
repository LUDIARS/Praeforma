// MUSA(Thaleia) リレー クライアント — Praeforma → MUSA → Anatomia。
//
// 設計方針 (ユーザ確定 2026-06-25):
//   - Pf × Anatomia = Thaleia (企画↔実装トレーサビリティ)。 ドキュメント文脈の主体は
//     Praeforma 側なので、 リレー契約は Praeforma 主導で「暫定」定義する。 MUSA 本体実装時に批准。
//   - Praeforma は Anatomia CLI を直叩きしない (Calliope 注意書き「エンジン二重実装せず
//     バインド/統括」)。 必ず MUSA 経由。
//   - PRAEFORMA_MUSA_URL 未設定なら mock に落とさず明示エラー (無言 fallback 禁止)。
//
// 暫定 wire 契約: POST {musaRelayUrl}/relay/anatomia
//   req  = MusaAnatomiaRequest, res = MusaAnatomiaResponse (下記)

import { AppError } from './errors.ts';
import type { AnatomiaRef, GraphNodeType, GraphRelation } from '../db/schema/code-graph.ts';

const DEFAULT_TIMEOUT_MS = 60_000;

export interface MusaRelayOptions {
  musaRelayUrl: string | null;
  musaRelayToken: string | null;
}

export interface MusaAnatomiaRequest {
  project: string;
  target: {
    kind: 'domain' | 'layout';
    id: string;
    name: string;
    description?: string | null;
  };
  requirements: Array<{
    code: string;
    title: string;
    description: string | null;
    priority: string;
    category: string;
    acceptance: string[];
  }>;
  query: string;
  /** 解析対象リポ (任意)。 MUSA 側が Anatomia project を解決できる場合は不要。 */
  repo?: string;
}

export interface MusaAnatomiaNode {
  key: string;
  label: string;
  type?: GraphNodeType;
  anatomia_ref?: AnatomiaRef;
}

export interface MusaAnatomiaEdge {
  /** from/to は node の `key` を参照する。 */
  from: string;
  to: string;
  relation?: GraphRelation;
}

export interface MusaAnatomiaResponse {
  nodes: MusaAnatomiaNode[];
  edges: MusaAnatomiaEdge[];
  summary?: string;
}

/** MUSA(Thaleia) に Anatomia リレーを依頼する。 未設定/失敗は明示エラー。 */
export async function relayAnatomia(
  opts: MusaRelayOptions,
  body: MusaAnatomiaRequest,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<MusaAnatomiaResponse> {
  if (!opts.musaRelayUrl) {
    throw new AppError('musa_relay_unconfigured', 503, {
      hint: 'PRAEFORMA_MUSA_URL を設定すると MUSA(Thaleia) 経由で Anatomia グラフを取得します。',
    });
  }
  const url = `${opts.musaRelayUrl.replace(/\/$/, '')}/relay/anatomia`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.musaRelayToken) headers.authorization = `Bearer ${opts.musaRelayToken}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new AppError('musa_relay_unreachable', 502, { url, reason: String(e) });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      /* ignore */
    }
    throw new AppError('musa_relay_failed', 502, { status: res.status, detail });
  }
  const json = (await res.json()) as Partial<MusaAnatomiaResponse>;
  return {
    nodes: Array.isArray(json.nodes) ? json.nodes : [],
    edges: Array.isArray(json.edges) ? json.edges : [],
    summary: json.summary,
  };
}
