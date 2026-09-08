import { spawn } from 'node:child_process';
import { getClaudeModel } from './llm.ts';
import { AppError } from './errors.ts';
export function runRestrictedWriter(binary: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const model = getClaudeModel();
    const child = spawn(binary, ['-p', '--tools', '', '--disable-slash-commands', '--no-session-persistence',
      '--setting-sources', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', ...(model ? ['--model', model] : [])], {
      shell: false, windowsHide: true, cwd: new URL('../../../', import.meta.url), stdio: ['pipe', 'pipe', 'pipe'],
    });
    let settled = false;
    let out = '';
    const finish = (error?: AppError): void => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      // Stop accumulating output from a child that may ignore termination.
      child.stdout.removeAllListeners('data'); child.stderr.removeAllListeners('data');
      if (error) { child.kill('SIGKILL'); reject(error); } else resolve(out);
    };
    const timer = setTimeout(() => finish(new AppError('llm_generation_timeout', 504)), 120000);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (text: string) => {
      out += text;
      if (out.length > 100000) finish(new AppError('llm_generation_too_large', 502));
    });
    child.stderr.on('data', () => { /* Drain diagnostics without disclosing source material or credentials. */ });
    child.on('error', () => finish(new AppError('llm_writer_unavailable', 503)));
    child.stdin.on('error', () => finish(new AppError('llm_writer_unavailable', 503)));
    child.on('close', code => finish(code === 0 ? undefined : new AppError('llm_generation_failed', 502)));
    child.stdin.end(prompt, 'utf8');
  });
}
