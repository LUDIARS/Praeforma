import { contract } from '@ludiars/log-weaver'; /* augur-inject:import:25b159ce */
import augurContract_83363161 from '../../contracts/pick-latest-run.contract.ts'; /* augur-inject:contract-predicate:315d5089 */
import augurContract_46a66820 from '../../contracts/tally-acceptance-results.contract.ts'; /* augur-inject:contract-predicate:c07f07ef */
import augurContract_cb667f08 from '../../contracts/summarize-acceptance.contract.ts'; /* augur-inject:contract-predicate:a9d912ef */
import augurContract_4ccb024d from '../../contracts/format-spec-version.contract.ts'; /* augur-inject:contract-predicate:f3ad6472 */
// @spec PF-ACC-SUM-2 応答
// 受入状態の要約 (spec/feature/acceptance-summary.md)。DB から読んだ行を受け取り応答を返す純関数。
// 個人情報 (triggered_by) と自由記述 (observed / error_message / log_excerpt) は入力にも出力にも持たない。

export interface AcceptanceRunRow {
  id: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface AcceptanceResultRow {
  status: string;
}

export interface SpecVersionHead {
  major: number;
  minor: number;
  patch: number;
}

export interface AcceptanceResultTally {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  pending: number;
}

export interface AcceptanceSummary {
  projectId: string;
  runs: { total: number; byStatus: Record<string, number> };
  latestRun: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    /** run 時点の仕様版。現スキーマは run に版を記録しないため null。 */
    version: string | null;
  } | null;
  results: AcceptanceResultTally;
  specVersion: string;
}

export interface AcceptanceSummaryInput {
  projectId: string;
  runs: readonly AcceptanceRunRow[];
  /** 最新 run の結果行 (run 0 件なら空)。 */
  latestResults: readonly AcceptanceResultRow[];
  specVersionHead: SpecVersionHead | null;
}

/** startedAt が最も新しい run。同時刻は id (ULID) の大きい方。0 件なら null。 */
export function pickLatestRun(runs: readonly AcceptanceRunRow[]): AcceptanceRunRow | null {
  let latest: AcceptanceRunRow | null = null;
  for (const run of runs) {
    if (!latest) { latest = run; continue; }
    const diff = run.startedAt.getTime() - latest.startedAt.getTime();
    if (diff > 0 || (diff === 0 && run.id > latest.id)) latest = run;
  }
  return latest;
}
// @ts-expect-error augur-inject
pickLatestRun = contract(pickLatestRun, { ...augurContract_83363161, contractId: 'C-1', mode: 'observe', sample: 1, where: 'server/src/lib/acceptance-summary.ts:54', rule: 'contract-wrap', id: '83363161' }); /* augur-inject:contract-wrap:83363161 */

/** pass→passed、fail→failed、error→blocked (評価できなかった)、skip とそれ以外→pending。 */
export function tallyAcceptanceResults(results: readonly AcceptanceResultRow[]): AcceptanceResultTally {
  const tally: AcceptanceResultTally = { total: results.length, passed: 0, failed: 0, blocked: 0, pending: 0 };
  for (const result of results) {
    if (result.status === 'pass') tally.passed += 1;
    else if (result.status === 'fail') tally.failed += 1;
    else if (result.status === 'error') tally.blocked += 1;
    else tally.pending += 1;
  }
  return tally;
}
// @ts-expect-error augur-inject
tallyAcceptanceResults = contract(tallyAcceptanceResults, { ...augurContract_46a66820, contractId: 'C-2', mode: 'observe', sample: 1, where: 'server/src/lib/acceptance-summary.ts:65', rule: 'contract-wrap', id: '46a66820' }); /* augur-inject:contract-wrap:46a66820 */

/** 仕様版の表示。版がまだ無いプロジェクトは 0.0.0 (spec/schema/spec-versioning.md の初期値)。 */
export function formatSpecVersion(head: SpecVersionHead | null): string {
  if (!head) return '0.0.0';
  return `${head.major}.${head.minor}.${head.patch}`;
}
// @ts-expect-error augur-inject
formatSpecVersion = contract(formatSpecVersion, { ...augurContract_4ccb024d, contractId: 'C-4', mode: 'observe', sample: 1, where: 'server/src/lib/acceptance-summary.ts:77', rule: 'contract-wrap', id: '4ccb024d' }); /* augur-inject:contract-wrap:4ccb024d */

export function summarizeAcceptance(input: AcceptanceSummaryInput): AcceptanceSummary {
  const byStatus: Record<string, number> = {};
  for (const run of input.runs) byStatus[run.status] = (byStatus[run.status] ?? 0) + 1;
  const latest = pickLatestRun(input.runs);
  return {
    projectId: input.projectId,
    runs: { total: input.runs.length, byStatus },
    latestRun: latest && {
      id: latest.id,
      status: latest.status,
      startedAt: latest.startedAt.toISOString(),
      finishedAt: latest.finishedAt ? latest.finishedAt.toISOString() : null,
      version: null,
    },
    results: tallyAcceptanceResults(latest ? input.latestResults : []),
    specVersion: formatSpecVersion(input.specVersionHead),
  };
}
// @ts-expect-error augur-inject
summarizeAcceptance = contract(summarizeAcceptance, { ...augurContract_cb667f08, contractId: 'C-3', mode: 'observe', sample: 1, where: 'server/src/lib/acceptance-summary.ts:82', rule: 'contract-wrap', id: 'cb667f08' }); /* augur-inject:contract-wrap:cb667f08 */
