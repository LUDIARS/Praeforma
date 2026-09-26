// @spec PF-ACC-SUM-2 応答
import type { tallyAcceptanceResults } from '../src/lib/acceptance-summary.ts';
import type { ContractOf } from './contract-types.ts';

/** C-2: every result lands in exactly one bucket; pass/fail/error map to passed/failed/blocked. */
export default {
  post: (tally, results) => {
    const count = (status: string) => results.filter((r) => r.status === status).length;
    if (tally.total !== results.length) return 'total differs from the number of results';
    if (tally.passed + tally.failed + tally.blocked + tally.pending !== tally.total) return 'buckets do not add up to total';
    if (tally.passed !== count('pass') || tally.failed !== count('fail') || tally.blocked !== count('error')) {
      return 'pass/fail/error are not counted as passed/failed/blocked';
    }
    return true;
  },
} satisfies ContractOf<typeof tallyAcceptanceResults>;
