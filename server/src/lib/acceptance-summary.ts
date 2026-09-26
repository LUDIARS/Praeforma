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

/** 仕様版の表示。版がまだ無いプロジェクトは 0.0.0 (spec/schema/spec-versioning.md の初期値)。 */
export function formatSpecVersion(head: SpecVersionHead | null): string {
  if (!head) return '0.0.0';
  return `${head.major}.${head.minor}.${head.patch}`;
}

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
