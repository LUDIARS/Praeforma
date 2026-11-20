import { readRoleMap } from '@ludiars/one-shot';
import type { resolveAstraModel } from '../src/lib/astra-cli.ts';
import type { ContractOf } from './contract-types.ts';

export default {
  post: (result, env) => {
    const settings = env ?? process.env;
    const expected = settings.LUDIARS_ONESHOT_MODEL_ASTRA || readRoleMap(settings)?.codex?.astra;
    return typeof expected === 'string' && expected.length > 0 && result === expected;
  },
} satisfies ContractOf<typeof resolveAstraModel>;
