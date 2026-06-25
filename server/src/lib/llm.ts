// LLM サジェスト — LUDIARS 規約により API は使わず claude CLI (`claude -p`) を spawn する。
//
// 注意 (memory): 長いプロンプトは stdin で渡す。 Windows では claude CLI が git-bash を
// 必要とする場合がある (PRAEFORMA_CLAUDE_BIN で wrapper を差せる)。 失敗時は無言 fallback
// せず明示エラー (= mock に落とさない)。

import { spawn } from 'node:child_process';
import { AppError } from './errors.ts';

const DEFAULT_TIMEOUT_MS = 120_000;

/** claude CLI を non-interactive (`-p`) で叩き、 stdout を返す。 プロンプトは stdin 経由。 */
export function runClaude(
  claudeBin: string,
  prompt: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(claudeBin, ['-p'], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      reject(new AppError('llm_spawn_failed', 503, { reason: String(e) }));
      return;
    }
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new AppError('llm_timeout', 504, { timeoutMs }));
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      out += String(d);
    });
    child.stderr.on('data', (d) => {
      err += String(d);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      // ENOENT 等。 ここで mock に落とさない (無言 fallback 禁止)。
      reject(new AppError('llm_unavailable', 503, { reason: String(e), bin: claudeBin }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new AppError('llm_failed', 502, { code, stderr: err.slice(0, 2000) }));
        return;
      }
      resolve(out);
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/** モデル出力から最初の JSON ブロック ({...} or [...]) を取り出して parse する。 */
export function extractJson<T>(text: string): T {
  const trimmed = text.trim();
  // ```json ... ``` フェンスを優先
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence?.[1] ?? trimmed;
  const start = body.search(/[[{]/);
  if (start < 0) throw new AppError('llm_no_json', 502, { excerpt: trimmed.slice(0, 500) });
  // 末尾の対応する括弧まで貪欲に取る
  const open = body[start];
  const close = open === '{' ? '}' : ']';
  const end = body.lastIndexOf(close);
  if (end <= start) throw new AppError('llm_no_json', 502, { excerpt: trimmed.slice(0, 500) });
  const slice = body.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch (e) {
    throw new AppError('llm_bad_json', 502, { reason: String(e), excerpt: slice.slice(0, 500) });
  }
}

// ── サジェスト用 DTO ───────────────────────────────────────────────────────

export interface SuggestedAcceptance {
  text: string;
  level: 'manual' | 'assertion' | 'event';
  kind: 'positive' | 'negative';
  expression?: string | null;
}

export interface SuggestedRequirement {
  code?: string;
  title: string;
  description: string;
  priority: 'must' | 'should' | 'could' | 'wont';
  category: 'behavior' | 'appearance' | 'data' | 'interaction';
  preconditions: string[];
  postconditions: string[];
  acceptance: SuggestedAcceptance[];
}

export interface SuggestInput {
  projectName: string;
  targetKind: 'domain' | 'scene';
  targetName: string;
  targetDescription?: string;
  existingTitles?: string[];
  note?: string;
}

const PRIORITY = "must / should / could / wont (MoSCoW)";
const CATEGORY = "behavior / appearance / data / interaction";
const LEVEL = "manual (人が確認) / assertion (述語) / event (時間軸パターン)";

function suggestPrompt(input: SuggestInput): string {
  return [
    'あなたはゲーム/アプリ開発の要件定義アシスタントです。',
    `プロジェクト「${input.projectName}」の ${input.targetKind === 'domain' ? 'ドメイン' : 'シーン'}「${input.targetName}」に対する要件定義 (requirements) を提案してください。`,
    input.targetDescription ? `対象の概要: ${input.targetDescription}` : '',
    input.existingTitles?.length ? `既存の要件 (重複を避ける): ${input.existingTitles.join(' / ')}` : '',
    input.note ? `プランナーからの補足/今やりたいこと: ${input.note}` : '',
    '',
    '各要件には回帰テスト用の acceptance 条件も設計してください。',
    `priority は ${PRIORITY}、 category は ${CATEGORY}、 acceptance.level は ${LEVEL}、 acceptance.kind は positive/negative。`,
    '',
    '出力は次の JSON のみ (説明文・前置きなし):',
    '{"requirements":[{"title":"...","description":"...","priority":"should","category":"behavior","preconditions":["..."],"postconditions":["..."],"acceptance":[{"text":"...","level":"manual","kind":"positive"}]}]}',
    '日本語で、 3〜6 件程度。',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function suggestRequirements(
  claudeBin: string,
  input: SuggestInput,
): Promise<{ requirements: SuggestedRequirement[] }> {
  const out = await runClaude(claudeBin, suggestPrompt(input));
  const parsed = extractJson<{ requirements?: SuggestedRequirement[] }>(out);
  return { requirements: normalizeRequirements(parsed.requirements ?? []) };
}

// ── 資料取り込み (ingest) ──────────────────────────────────────────────────

export interface IngestInput {
  projectName: string;
  /** 仕様書 / 画面遷移リスト / Anatomia 解析結果などの素テキスト。 */
  material: string;
  kind: 'spec-doc' | 'screen-list' | 'anatomia-result' | 'other';
}

export interface IngestProposalRequirement extends SuggestedRequirement {
  targetKind: 'domain' | 'scene';
  targetName: string;
}

export interface IngestProposal {
  domains: Array<{ name: string; description: string }>;
  scenes: Array<{ name: string; description: string }>;
  requirements: IngestProposalRequirement[];
}

function ingestPrompt(input: IngestInput): string {
  return [
    'あなたはゲーム/アプリ開発の要件定義アシスタントです。',
    `プロジェクト「${input.projectName}」のベーススペックを作るため、 以下の資料 (種別: ${input.kind}) を読み、`,
    'ドメイン (役割/領域) と シーン (画面/場面) を抽出し、 それぞれの初期要件を提案してください。',
    '',
    '--- 資料ここから ---',
    input.material.slice(0, 24_000),
    '--- 資料ここまで ---',
    '',
    `requirements[].priority は ${PRIORITY}、 category は ${CATEGORY}、 acceptance.level は ${LEVEL}。`,
    '出力は次の JSON のみ (説明文なし):',
    '{"domains":[{"name":"...","description":"..."}],"scenes":[{"name":"...","description":"..."}],"requirements":[{"targetKind":"domain","targetName":"...","title":"...","description":"...","priority":"should","category":"behavior","preconditions":[],"postconditions":[],"acceptance":[{"text":"...","level":"manual","kind":"positive"}]}]}',
    '日本語で。',
  ].join('\n');
}

export async function ingestDocuments(
  claudeBin: string,
  input: IngestInput,
): Promise<IngestProposal> {
  const out = await runClaude(claudeBin, ingestPrompt(input));
  const parsed = extractJson<Partial<IngestProposal>>(out);
  const reqs = (parsed.requirements ?? []).map((r) => ({
    ...normalizeRequirement(r),
    targetKind: r.targetKind === 'scene' ? ('scene' as const) : ('domain' as const),
    targetName: String(r.targetName ?? ''),
  }));
  return {
    domains: (parsed.domains ?? []).map((d) => ({
      name: String(d.name ?? ''),
      description: String(d.description ?? ''),
    })),
    scenes: (parsed.scenes ?? []).map((s) => ({
      name: String(s.name ?? ''),
      description: String(s.description ?? ''),
    })),
    requirements: reqs,
  };
}

// ── 正規化 (モデル出力の型ゆれを吸収) ──────────────────────────────────────

const PRIORITIES = new Set(['must', 'should', 'could', 'wont']);
const CATEGORIES = new Set(['behavior', 'appearance', 'data', 'interaction']);
const LEVELS = new Set(['manual', 'assertion', 'event']);

function normalizeRequirement(r: Partial<SuggestedRequirement>): SuggestedRequirement {
  return {
    title: String(r.title ?? '(untitled)').slice(0, 200),
    description: String(r.description ?? ''),
    priority: PRIORITIES.has(r.priority as string) ? (r.priority as SuggestedRequirement['priority']) : 'should',
    category: CATEGORIES.has(r.category as string) ? (r.category as SuggestedRequirement['category']) : 'behavior',
    preconditions: Array.isArray(r.preconditions) ? r.preconditions.map(String) : [],
    postconditions: Array.isArray(r.postconditions) ? r.postconditions.map(String) : [],
    acceptance: Array.isArray(r.acceptance)
      ? r.acceptance.map((a) => ({
          text: String(a.text ?? ''),
          level: LEVELS.has(a.level as string) ? (a.level as SuggestedAcceptance['level']) : 'manual',
          kind: a.kind === 'negative' ? 'negative' : 'positive',
          expression: a.expression ?? null,
        }))
      : [],
  };
}

function normalizeRequirements(rs: Partial<SuggestedRequirement>[]): SuggestedRequirement[] {
  return rs.map(normalizeRequirement);
}
