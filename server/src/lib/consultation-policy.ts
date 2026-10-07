import { join, isAbsolute } from 'node:path';
import { AppError } from './errors.ts';
import { contract } from '@ludiars/log-weaver'; /* augur-inject:import:48bd1842 */
import augurContract_6622ad68 from '../../contracts/consultation-policy.contract.ts'; /* augur-inject:contract-predicate:c600b99e */

export interface ConsultationPolicy { args: string[]; cwd: string; env: NodeJS.ProcessEnv }

/** A fixed capability set, never derived from a message or a former agent session. */
export function buildConsultationPolicy(model: string, cwd: string, token: string, source: NodeJS.ProcessEnv): ConsultationPolicy {
  if (!token || !model || !isAbsolute(cwd)) throw new AppError('consultation_unconfigured', 503);
  const env: NodeJS.ProcessEnv = {};
  for (const name of ['PATH', 'SystemRoot', 'WINDIR']) {
    const key = Object.keys(source).find(key => key.toLowerCase() === name.toLowerCase());
    if (key && source[key]) env[name] = source[key];
  }
  Object.assign(env, { HOME: cwd, USERPROFILE: cwd, APPDATA: cwd, LOCALAPPDATA: cwd,
    TEMP: cwd, TMP: cwd, CLAUDE_CONFIG_DIR: join(cwd, '.claude'),
    CLAUDE_CODE_OAUTH_TOKEN: token, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' });
  return { cwd, env, args: ['-p', '--bare', '--restricted', '--model', model, '--output-format', 'text', '--tools', '',
    '--disallowedTools', '*',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '',
    '--settings', '{"disableAllHooks":true}', '--disable-slash-commands', '--no-session-persistence',
    '--system-prompt', 'You discuss specifications and designs using only the supplied conversation. Respond in Japanese. You have no tools or implementation authority.'] };
}
// @ts-expect-error augur-inject
buildConsultationPolicy = contract(buildConsultationPolicy, { ...augurContract_6622ad68, contractId: 'C-7', mode: 'observe', sample: 1, where: 'server/src/lib/consultation-policy.ts:7', rule: 'contract-wrap', id: '6622ad68' }); /* augur-inject:contract-wrap:6622ad68 */
