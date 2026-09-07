import { spawn } from 'node:child_process';
import { AppError } from './errors.ts';
import { getClaudeModel } from './llm.ts';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_STDOUT_BYTES = 5 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;

function resultText(value: unknown): unknown {
  if (!value || typeof value !== 'object') throw new AppError('llm_bad_json', 502);
  const record = value as Record<string, unknown>;
  if (record.is_error === true || record.subtype === 'error') {
    throw new AppError('llm_failed', 502, { result: String(record.result ?? '') });
  }
  if (record.structured_output !== undefined) return record.structured_output;
  if (typeof record.result !== 'string') throw new AppError('llm_bad_json', 502);
  try {
    return JSON.parse(record.result);
  } catch (error) {
    throw new AppError('llm_bad_json', 502, { reason: String(error) });
  }
}

/** Sends image bytes as an explicit Claude content block; no file or tool access is involved. */
export function runClaudeVision(
  claudeBin: string,
  input: { prompt: string; image: Uint8Array; mimeType: string; jsonSchema: Record<string, unknown> },
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const model = getClaudeModel();
    const args = [
      '-p',
      '--input-format', 'stream-json',
      '--output-format', 'json',
      '--json-schema', JSON.stringify(input.jsonSchema),
      '--tools', '',
      '--no-session-persistence',
      ...(model ? ['--model', model] : []),
    ];
    let child;
    try {
      child = spawn(claudeBin, args, {
        cwd: process.cwd(),
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      reject(new AppError('llm_spawn_failed', 503, { reason: String(error) }));
      return;
    }
    let settled = false;
    let stdout = '';
    let stderr = '';
    const finishReject = (error: AppError): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!child.killed) child.kill('SIGKILL');
      reject(error);
    };
    const timer = setTimeout(() => {
      finishReject(new AppError('llm_timeout', 504, { timeoutMs }));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (settled) return;
      stdout += chunk;
      if (Buffer.byteLength(stdout, 'utf8') > MAX_STDOUT_BYTES) {
        finishReject(new AppError('llm_output_too_large', 502));
      }
    });
    child.stderr.on('data', (chunk: string) => {
      if (Buffer.byteLength(stderr, 'utf8') < MAX_STDERR_BYTES) stderr += chunk;
    });
    child.on('error', (error) => {
      finishReject(new AppError('llm_unavailable', 503, { reason: String(error), bin: claudeBin }));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new AppError('llm_failed', 502, { code, stderr: stderr.slice(0, MAX_STDERR_BYTES) }));
        return;
      }
      try {
        resolve(resultText(JSON.parse(stdout)));
      } catch (error) {
        reject(error instanceof AppError ? error : new AppError('llm_bad_json', 502, { reason: String(error) }));
      }
    });
    child.stdin.on('error', (error) => {
      finishReject(new AppError('llm_input_failed', 502, { reason: String(error) }));
    });
    const message = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'text', text: input.prompt },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: input.mimeType,
              data: Buffer.from(input.image).toString('base64'),
            },
          },
        ],
      },
    };
    child.stdin.end(`${JSON.stringify(message)}\n`);
  });
}
