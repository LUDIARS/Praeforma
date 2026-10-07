import { spawnOneShot as spawn } from '@ludiars/one-shot';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildConsultationPolicy } from './consultation-policy.ts';
import { getClaudeModel } from './llm.ts';
import { AppError } from './errors.ts';
import type { ChatMessage } from '../../../shared/llm-chat.ts';

export interface ConsultationRunner { reply(messages: readonly ChatMessage[]): Promise<string> }

/** One isolated, tool-less print process per turn. No Cc client or implementation dispatcher. */
export class CliConsultationRunner implements ConsultationRunner {
  constructor(private readonly binary: string) {}

  async reply(messages: readonly ChatMessage[]): Promise<string> {
    const token = process.env.PRAEFORMA_CONSULTATION_OAUTH_TOKEN;
    if (!token || !this.binary) throw new AppError('consultation_unconfigured', 503);
    const prompt = JSON.stringify(messages.map(({ role, text }) => ({ role, text })));
    if (prompt.length > 200000) throw AppError.conflict('consultation_history_too_large');
    const cwd = await mkdtemp(join(tmpdir(), 'pf-consultation-'));
    try {
      const policy = buildConsultationPolicy(getClaudeModel(), cwd, token, process.env);
      return await new Promise<string>((resolve, reject) => {
        const child = spawn(this.binary, policy.args, { cwd: policy.cwd, env: policy.env,
          shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let output = '';
        let failure: AppError | undefined;
        const stop = (error: AppError): void => {
          failure ??= error;
          child.kill('SIGKILL');
        };
        const timer = setTimeout(() => stop(new AppError('consultation_timeout', 504)), 120000);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
          if (failure) return;
          output += chunk;
          if (output.length > 100000) stop(new AppError('consultation_output_too_large', 502));
        });
        child.stderr.resume(); // Drain without exposing credentials or private conversation in errors.
        child.once('error', () => { failure ??= new AppError('consultation_unavailable', 503); });
        child.stdin.once('error', () => stop(new AppError('consultation_input_failed', 502)));
        child.once('close', code => {
          clearTimeout(timer);
          if (failure) reject(failure);
          else if (code !== 0 || !output.trim()) reject(new AppError('consultation_failed', 502));
          else resolve(output.trim());
        });
        child.stdin.end(prompt, 'utf8');
      });
    } finally {
      // mkdtemp owns this exact directory; never remove a configured/shared credential directory.
      await rm(cwd, { recursive: true, force: true });
    }
  }
}
