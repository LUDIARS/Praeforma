import type { buildConsultationPolicy } from '../src/lib/consultation-policy.ts';
import type { ContractOf } from './contract-types.ts';

export default {
  post: (result, _model, cwd) => {
    const args = result.args;
    const value = (flag: string): string | undefined => args[args.indexOf(flag) + 1];
    const allowed = new Set(['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE',
      'APPDATA', 'LOCALAPPDATA', 'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC']);
    return args.includes('--bare') && args.includes('--restricted') && value('--disallowedTools') === '*'
      && args.includes('--tools') && value('--tools') === ''
      && args.includes('--strict-mcp-config') && value('--mcp-config') === '{"mcpServers":{}}'
      && value('--setting-sources') === '' && value('--settings') === '{"disableAllHooks":true}'
      && args.includes('--disable-slash-commands') && args.includes('--no-session-persistence')
      && result.cwd === cwd && result.env.HOME === cwd && result.env.USERPROFILE === cwd
      && Object.keys(result.env).every(key => allowed.has(key));
  },
} satisfies ContractOf<typeof buildConsultationPolicy>;
