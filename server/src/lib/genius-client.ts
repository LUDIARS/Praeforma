import { AppError } from './errors.ts';

const DEFAULT_TIMEOUT_MS = 15_000;

export interface GeniusOptions {
  baseUrl: string | null;
}

/**
 * Genius 連携はオプトイン。 `PRAEFORMA_GENIUS_URL` を設定したときだけ有効になる。
 *
 * Genius は判断カードの蓄積先であって、 Praeforma の UX・コアドメイン設計が成立する
 * ための必須依存ではない。 過去判断の再利用は「あれば効く」補助で、 境界の採否は常に
 * 人間が行う (`spec/feature/ux-core-design.md`)。 未設定を失敗として扱うと、 補助が
 * 無いだけで設計作業そのものが止まる。
 */
export function isGeniusEnabled(options: GeniusOptions): boolean {
  return typeof options.baseUrl === 'string' && options.baseUrl.trim() !== '';
}

export interface GeniusCard {
  id: string;
  situation: string;
  judgment: string;
  rationale: string;
  confidence: number;
  score: number | null;
  sourceRef: string | null;
}

async function postJson(
  options: GeniusOptions,
  path: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  if (!options.baseUrl) throw new AppError('genius_unconfigured', 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${options.baseUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new AppError('genius_upstream_failed', 502, { status: response.status, path });
    return await response.json().catch(() => { throw new AppError('genius_bad_payload', 502); });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('genius_unreachable', 502, { reason: String(error) });
  } finally {
    clearTimeout(timer);
  }
}

export async function queryGenius(
  options: GeniusOptions,
  input: { text: string; visibility: 'public' | 'sensitive' },
): Promise<{ cards: GeniusCard[]; raw: Record<string, unknown> }> {
  const visibilities: Array<'public' | 'sensitive'> = input.visibility === 'sensitive'
    ? ['public', 'sensitive']
    : ['public'];
  const values = await Promise.all(visibilities.map((visibility) => postJson(options, '/api/clone/query', {
    text: input.text,
    domain: 'work',
    visibility,
    categories: ['impl-design'],
    k: 8,
  })));
  const value = values[0];
  if (!value || typeof value !== 'object') throw new AppError('genius_bad_payload', 502);
  const raws = values.map((entry) => {
    if (!entry || typeof entry !== 'object' || !Array.isArray((entry as Record<string, unknown>).cards)) {
      throw new AppError('genius_bad_payload', 502);
    }
    return entry as Record<string, unknown>;
  });
  const cards = raws.flatMap((raw) => (raw.cards as unknown[]).map((entry): GeniusCard => {
    if (!entry || typeof entry !== 'object') throw new AppError('genius_bad_payload', 502);
    const card = entry as Record<string, unknown>;
    if (typeof card.id !== 'string' || typeof card.situation !== 'string'
      || typeof card.judgment !== 'string' || typeof card.rationale !== 'string'
      || typeof card.confidence !== 'number') throw new AppError('genius_bad_payload', 502);
    return {
      id: card.id,
      situation: card.situation,
      judgment: card.judgment,
      rationale: card.rationale,
      confidence: card.confidence,
      score: typeof card.score === 'number' ? card.score : null,
      sourceRef: typeof card.sourceRef === 'string' ? card.sourceRef : null,
    };
  }));
  const uniqueCards = [...new Map(cards.map((card) => [card.id, card])).values()]
    .sort((left, right) => (right.score ?? -1) - (left.score ?? -1))
    .slice(0, 8);
  return { cards: uniqueCards, raw: { queries: raws } };
}

export async function publishGeniusDecision(
  options: GeniusOptions,
  input: {
    visibility: 'public' | 'sensitive';
    situation: string;
    judgment: string;
    rationale: string;
    sourceRef: string;
  },
): Promise<{ id: string }> {
  const value = await postJson(options, '/api/clone/cards', {
    domain: 'work',
    visibility: input.visibility,
    category: 'impl-design',
    situation: input.situation,
    judgment: input.judgment,
    rationale: input.rationale,
    tags: ['praeforma', 'ux-core-domain'],
    // This confidence records that a human explicitly made the decision. It is
    // not a score for automatically applying the boundary in another context.
    confidence: 1,
    sourceRef: input.sourceRef,
    sourceTier: 1,
  });
  if (!value || typeof value !== 'object' || typeof (value as Record<string, unknown>).id !== 'string') {
    throw new AppError('genius_bad_payload', 502);
  }
  return { id: (value as Record<string, unknown>).id as string };
}
