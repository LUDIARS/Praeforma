import { isDeepStrictEqual } from 'node:util';
import { contract } from '@ludiars/log-weaver'; /* augur-inject:import:edddaa51 */
import augurContract_010df938 from '../contracts/dompurify-lock.contract.ts'; /* augur-inject:contract-predicate:29cd9d06 */

type Lock = { packages: Record<string, { version?: string; resolved?: string; integrity?: string; dependencies?: Record<string, string>; [key: string]: unknown }> };

/** Verify the narrowly authorized lock update without resolving other dependencies. */
export function verifyDompurifyLockUpdate(before: Lock, after: Lock): boolean {
  const expected = structuredClone(before);
  const target = expected.packages['node_modules/dompurify'];
  if (!target || before.packages['node_modules/mermaid']?.dependencies?.['dompurify'] !== '^3.3.3') return false;
  Object.assign(target, {
    version: '3.4.17',
    resolved: 'https://registry.npmjs.org/dompurify/-/dompurify-3.4.17.tgz',
    integrity: 'sha512-B/pSlYVHQ58kqISD/yDjuJ1yfzI34m1gF4lAod2bwSRhiN4K5Cl3H8Af7hqB2PmTL911tdEudnnXn5FnhRoz0w==',
  });
  return isDeepStrictEqual(expected, after);
}
// @ts-expect-error augur-inject
verifyDompurifyLockUpdate = contract(verifyDompurifyLockUpdate, { ...augurContract_010df938, contractId: 'C-9', mode: 'observe', sample: 1, where: 'server/scripts/verify-dompurify-lock.ts:6', rule: 'contract-wrap', id: '010df938' }); /* augur-inject:contract-wrap:010df938 */
