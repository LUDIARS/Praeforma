// @spec PF-ACC-SUM-2 応答
import type { pickLatestRun } from '../src/lib/acceptance-summary.ts';
import type { ContractOf } from './contract-types.ts';

/** C-1: no runs → null; otherwise no other run is newer (startedAt, then id). */
export default {
  post: (latest, runs) => {
    if (runs.length === 0) return latest === null ? true : 'picked a run from an empty list';
    if (!latest || !runs.includes(latest)) return 'latest run is not one of the inputs';
    const newer = runs.find((r) => r.startedAt.getTime() > latest.startedAt.getTime()
      || (r.startedAt.getTime() === latest.startedAt.getTime() && r.id > latest.id));
    return newer ? `run ${newer.id} is newer than ${latest.id}` : true;
  },
} satisfies ContractOf<typeof pickLatestRun>;
