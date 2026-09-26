// @spec PF-ACC-SUM-2 応答
import type { summarizeAcceptance } from '../src/lib/acceptance-summary.ts';
import type { ContractOf } from './contract-types.ts';

const PRIVATE_KEYS = /"(triggeredBy|triggered_by|observed|errorMessage|error_message|logExcerpt|log_excerpt|summary)"/;

/** C-3: run counts agree, empty projects report nothing, and no private/free-text keys leak. */
export default {
  post: (summary, input) => {
    const byStatusTotal = Object.values(summary.runs.byStatus).reduce((a, b) => a + b, 0);
    if (summary.runs.total !== input.runs.length || byStatusTotal !== summary.runs.total) return 'run counts disagree';
    if (input.runs.length === 0) {
      if (summary.latestRun !== null) return 'latestRun must be null without runs';
      if (Object.values(summary.results).some((n) => n !== 0)) return 'results must be zero without runs';
    }
    return PRIVATE_KEYS.test(JSON.stringify(summary)) ? 'summary exposes a private or free-text key' : true;
  },
} satisfies ContractOf<typeof summarizeAcceptance>;
