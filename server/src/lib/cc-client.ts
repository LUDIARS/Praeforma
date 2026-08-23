// Concordia (Cc) クライアント — 確定仕様を delegation として送出し、 run 状態を取り込む
// (feature/screen-flow.md §6)。
//
//   - POST /v1/delegation/invoke { call_name, args, extra_prompt } → { run_id }
//   - GET  /v1/delegation/runs/:id → { run: { status } }
//   - Cc は loopback 信頼境界で bearer 任意。 設定があれば Authorization を付ける。
//   - 未設定なら mock に落とさず明示エラー (cc_unconfigured)。
//   - call_name / cwd は **サーバ設定 (PRAEFORMA_CC_TEMPLATE) が正**。 リクエスト body から
//     受けない (§6.3。 受けると任意 template / 任意 cwd で agent を起動できてしまう)。
//
// @spec 6.1 何を繋ぐか

import { AppError } from './errors.ts';
import type { CcStatus } from '../db/schema/screen-flow.ts';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface CcClientOptions {
  ccUrl: string | null;
  ccToken: string | null;
  /** 既定の delegation template (call_name)。 */
  ccTemplate: string | null;
}

export interface CcInvokeInput {
  args: Record<string, unknown>;
  extraPrompt: string;
}

export interface CcInvokeResult {
  runId: string;
  promptFilePath: string | null;
}

/** Cc の run status (9 値) を cc_links.status (4 値) に畳む。 純関数 (テスト対象)。 */
export function foldCcStatus(raw: string | null | undefined): CcStatus {
  switch (raw) {
    case 'completed':
      return 'done';
    case 'failed':
    case 'spawn_failed':
      return 'failed';
    case 'launching':
    case 'spawned':
    case 'running':
    case 'blocked':
      return 'running';
    default:
      return 'queued';
  }
}

function headers(opts: CcClientOptions): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.ccToken) h.authorization = `Bearer ${opts.ccToken}`;
  return h;
}

async function request(
  opts: CcClientOptions,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<unknown> {
  if (!opts.ccUrl) throw new AppError('cc_unconfigured', 503);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(`${opts.ccUrl.replace(/\/+$/, '')}${path}`, {
      ...init,
      headers: headers(opts),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new AppError('cc_unreachable', 502, { reason: String(e) });
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new AppError('cc_failed', 502, { status: res.status, body });
  return body;
}

export async function invokeDelegation(
  opts: CcClientOptions,
  input: CcInvokeInput,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CcInvokeResult> {
  const callName = opts.ccTemplate;
  if (!callName) throw new AppError('cc_template_required', 400);
  const body = (await request(
    opts,
    '/v1/delegation/invoke',
    {
      method: 'POST',
      body: JSON.stringify({
        call_name: callName,
        args: input.args,
        extra_prompt: input.extraPrompt,
        triggered_by: 'praeforma',
      }),
    },
    fetchImpl,
    timeoutMs,
  )) as { run_id?: unknown; prompt_file_path?: unknown } | null;
  if (!body || typeof body.run_id !== 'string') throw new AppError('cc_bad_payload', 502);
  return {
    runId: body.run_id,
    promptFilePath: typeof body.prompt_file_path === 'string' ? body.prompt_file_path : null,
  };
}

export async function fetchRunStatus(
  opts: CcClientOptions,
  runId: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ raw: string | null; status: CcStatus }> {
  const body = (await request(
    opts,
    `/v1/delegation/runs/${encodeURIComponent(runId)}`,
    { method: 'GET' },
    fetchImpl,
    timeoutMs,
  )) as { run?: { status?: unknown } } | null;
  const raw = typeof body?.run?.status === 'string' ? body.run.status : null;
  return { raw, status: foldCcStatus(raw) };
}
