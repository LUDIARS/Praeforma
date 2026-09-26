// @spec PF-ACC-SUM-2 応答
import type { formatSpecVersion } from '../src/lib/acceptance-summary.ts';
import type { ContractOf } from './contract-types.ts';

/** C-4: missing head is 0.0.0; otherwise major.minor.patch. */
export default {
  post: (version, head) => {
    const expected = head ? `${head.major}.${head.minor}.${head.patch}` : '0.0.0';
    return version === expected ? true : `expected ${expected}, got ${version}`;
  },
} satisfies ContractOf<typeof formatSpecVersion>;
