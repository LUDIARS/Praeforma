// Astra (GPT-6 Astra、gpt-6-astra) を Codex CLI で 1 回呼ぶ (spec/feature/concept-sheet.md PF-CS-3)。
// - 読み取り専用 sandbox・一時フォルダを作業場所にし、Pf のリポやファイルに触れさせない。
// - 画像は一時フォルダへ書いて --image で渡し、最終応答は --output-schema の形で -o のファイルに受ける。
// - 一時フォルダは成功・失敗・時間切れのどの経路でも消す。
// - Codex CLI が無いときは 503 で止める。別のモデルへ黙って切り替えない (RULE_CODE §7.1)。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppError } from './errors.ts';

export const ASTRA_MODEL = 'gpt-6-astra';
export type AstraEffort = 'medium' | 'high' | 'xhigh';

export interface AstraRequest {
  prompt: string;
  images: Array<{ bytes: Uint8Array; ext: 'png' | 'jpg' | 'webp' }>;
  outputSchema: Record<string, unknown>;
  effort: AstraEffort;
  timeoutMs: number;
}

/** PRAEFORMA_CODEX_BIN、無ければ標準の導入先、それも無ければ PATH の codex。 */
export function resolveCodexBin(env: NodeJS.ProcessEnv = process.env): string {
  if (env.PRAEFORMA_CODEX_BIN) return env.PRAEFORMA_CODEX_BIN;
  const installed = env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe') : '';
  return installed && existsSync(installed) ? installed : 'codex';
}

export async function runAstra(bin: string, request: AstraRequest): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'pf-astra-'));
  try {
    const imagePaths: string[] = [];
    for (const [i, image] of request.images.entries()) {
      const file = path.join(dir, `scene-${i}.${image.ext}`);
      await writeFile(file, image.bytes);
      imagePaths.push(file);
    }
    const schemaPath = path.join(dir, 'schema.json');
    await writeFile(schemaPath, JSON.stringify(request.outputSchema), 'utf8');
    const outPath = path.join(dir, 'last-message.txt');
    const args = ['exec', '-m', ASTRA_MODEL, '-s', 'read-only', '--skip-git-repo-check', '--ephemeral', '--ignore-rules',
      '-C', dir, '-c', `model_reasoning_effort="${request.effort}"`, '--output-schema', schemaPath, '-o', outPath,
      // --image は値を続けて取るので、1 枚ずつ = で渡し、最後の - (標準入力から指示を読む) を画像と取り違えさせない。
      ...imagePaths.map((p) => `--image=${p}`), '-'];
    await runProcess(bin, args, dir, request.prompt, request.timeoutMs);
    const text = await readFile(outPath, 'utf8').catch(() => '');
    if (!text.trim()) throw new AppError('astra_no_output', 502);
    return text;
  } finally {
    // 時間切れで止めた直後は、子がファイルを掴んだままのことがある。片付けの失敗で本来の結果・失敗を上書きしない。
    await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 })
      .catch((error: unknown) => { console.warn(`[astra] failed to remove temp dir: ${String(error)}`); });
  }
}

function runProcess(bin: string, args: string[], cwd: string, stdin: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(bin, args, { cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const finish = (error?: AppError): void => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) { child.kill('SIGKILL'); reject(error); } else resolve();
    };
    const timer = setTimeout(() => finish(new AppError('astra_timeout', 504, { timeoutMs })), timeoutMs);
    // 進行ログは読まずに捨てる (材料や資格情報を応答やログへ出さない)。捨てないと子が書き込みで止まる。
    child.stdout.on('data', () => { /* drain */ });
    child.stderr.on('data', () => { /* drain */ });
    child.on('error', () => finish(new AppError('astra_unavailable', 503, { bin })));
    child.stdin.on('error', () => finish(new AppError('astra_unavailable', 503, { bin })));
    child.on('close', (code) => finish(code === 0 ? undefined : new AppError('astra_failed', 502, { code })));
    child.stdin.end(stdin, 'utf8');
  });
}
