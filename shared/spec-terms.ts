/**
 * 構造化仕様に記載する数値計測と契約 (条件と報酬)。spec/feature/deferred-planning.md「数値計測と契約」。
 *
 * ここは「仕様に書く」ための形だけを持つ。実際の計測や報酬付与は実行しない。
 * 目標値と実測値は分け、未計測 (observed = null) を 0 として扱わない。
 * 未定義の箇所や、同じ指標名で単位・期間が違うものは推測で揃えず、未解決事項として返す。
 */
// @spec PF-SPEC-TERMS 数値計測と契約の記載
import { z } from 'zod';

export const SPEC_TERMS_MAX_ITEMS = 50;

const id = z.string().trim().min(1).max(64);
const text = (max: number) => z.string().trim().max(max);

/** 観測した実測値。どこで観測したか (ref) を必須にし、根拠の無い数値を置かない。 */
export const measurementObservationSchema = z.object({
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(50),
  observedAt: z.string().trim().max(40).nullable(),
  ref: z.string().trim().min(1).max(500),
}).strict();

export const measurementSchema = z.object({
  id,
  /** 計測の対象 (機能・仕様の呼び名)。空なら記載先の仕様そのもの。 */
  subject: text(200),
  metric: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(50),
  method: text(2000),
  /** 期間と集計方法 (例: 「リリース後 7 日、日次の中央値」)。 */
  period: text(200),
  /** 目標・判定条件 (例: 「95 パーセンタイルで 200ms 以下」)。 */
  target: text(2000),
  /** 実測値。未計測は null。0 は「0 を観測した」意味で、未計測とは別。 */
  observed: measurementObservationSchema.nullable(),
}).strict();

export const contractRewardSchema = z.object({
  /** 報酬の内容。金銭に限らない (アイテム、称号、権利など)。 */
  content: text(500),
  amount: z.number().finite().nullable(),
  unit: z.string().trim().max(50).nullable(),
}).strict();

export const contractSchema = z.object({
  id,
  subject: text(200),
  /** 成立条件。 */
  condition: text(2000),
  /** 条件の判定方法と根拠。 */
  judgement: text(2000),
  reward: contractRewardSchema,
  /** 付与時点。 */
  grantTiming: text(500),
  /** 例外・取消条件。 */
  exceptions: text(2000),
}).strict();

const uniqueIds = <T extends { id: string }>(items: readonly T[], ctx: z.RefinementCtx) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'id'], message: `duplicate id "${item.id}"` });
    seen.add(item.id);
  });
};

export const measurementsSchema = z.array(measurementSchema).max(SPEC_TERMS_MAX_ITEMS).superRefine(uniqueIds);
export const contractsSchema = z.array(contractSchema).max(SPEC_TERMS_MAX_ITEMS).superRefine(uniqueIds);

export type MeasurementObservation = z.infer<typeof measurementObservationSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export type ContractReward = z.infer<typeof contractRewardSchema>;
export type Contract = z.infer<typeof contractSchema>;

export interface SpecTerms {
  measurements: readonly Measurement[];
  contracts: readonly Contract[];
}

export type SpecTermIssueKind =
  | 'measurement_target_undefined'
  | 'measurement_observed_unit_mismatch'
  | 'measurement_metric_conflict'
  | 'contract_condition_undefined'
  | 'contract_judgement_undefined'
  | 'contract_reward_undefined'
  | 'contract_reward_unit_missing'
  | 'contract_grant_timing_undefined';

export interface SpecTermIssue {
  kind: SpecTermIssueKind;
  /** 対象の計測・契約の id (指標の衝突は関係するもの全部)。 */
  ids: string[];
  message: string;
}

/** 実測値の見せ方。未計測は「未計測」と書き、0 に置き換えない。 */
export function observedLabel(measurement: Pick<Measurement, 'observed'>): string {
  const observed = measurement.observed;
  return observed === null ? '未計測' : `${observed.value} ${observed.unit}`;
}

const metricKey = (measurement: Measurement): string =>
  `${measurement.subject.trim()}\u0000${measurement.metric.trim().toLowerCase()}`;

/**
 * 未定義の箇所と食い違いを未解決事項として列挙する。値を補ったり揃えたりはしない。
 * 同じ対象・同じ指標名でも、単位か期間が違えば同一視せず衝突として返す。
 */
export function specTermIssues(terms: SpecTerms): SpecTermIssue[] {
  const issues: SpecTermIssue[] = [];
  for (const measurement of terms.measurements) {
    if (!measurement.target) {
      issues.push({ kind: 'measurement_target_undefined', ids: [measurement.id], message: `計測「${measurement.metric}」の目標・判定条件が未定義です` });
    }
    if (measurement.observed !== null && measurement.observed.unit !== measurement.unit) {
      issues.push({
        kind: 'measurement_observed_unit_mismatch', ids: [measurement.id],
        message: `計測「${measurement.metric}」の実測値の単位 (${measurement.observed.unit}) が指標の単位 (${measurement.unit}) と違います`,
      });
    }
  }
  const byMetric = new Map<string, Measurement[]>();
  for (const measurement of terms.measurements) {
    const group = byMetric.get(metricKey(measurement)) ?? [];
    group.push(measurement);
    byMetric.set(metricKey(measurement), group);
  }
  for (const group of byMetric.values()) {
    const units = new Set(group.map((item) => item.unit));
    const periods = new Set(group.map((item) => item.period));
    if (group.length > 1 && (units.size > 1 || periods.size > 1)) {
      issues.push({
        kind: 'measurement_metric_conflict', ids: group.map((item) => item.id),
        message: `指標「${group[0]!.metric}」が単位 (${[...units].join(' / ')}) または期間 (${[...periods].map((p) => p || '未定義').join(' / ')}) の違う形で重複しています`,
      });
    }
  }
  for (const contract of terms.contracts) {
    const label = contract.subject || contract.id;
    if (!contract.condition) issues.push({ kind: 'contract_condition_undefined', ids: [contract.id], message: `契約「${label}」の成立条件が未定義です` });
    if (!contract.judgement) issues.push({ kind: 'contract_judgement_undefined', ids: [contract.id], message: `契約「${label}」の判定方法と根拠が未定義です` });
    if (!contract.reward.content) issues.push({ kind: 'contract_reward_undefined', ids: [contract.id], message: `契約「${label}」の報酬の内容が未定義です` });
    if (contract.reward.amount !== null && !contract.reward.unit) {
      issues.push({ kind: 'contract_reward_unit_missing', ids: [contract.id], message: `契約「${label}」の報酬の量 (${contract.reward.amount}) に単位がありません` });
    }
    if (!contract.grantTiming) issues.push({ kind: 'contract_grant_timing_undefined', ids: [contract.id], message: `契約「${label}」の付与時点が未定義です` });
  }
  return issues;
}

/** 保存値 (JSON 文字列または配列) を読む。壊れた値は空として扱わず例外にする。 */
export function parseSpecTerms(measurements: unknown, contracts: unknown): { measurements: Measurement[]; contracts: Contract[] } {
  const read = (value: unknown): unknown => (typeof value === 'string' ? JSON.parse(value) : value ?? []);
  return { measurements: measurementsSchema.parse(read(measurements)), contracts: contractsSchema.parse(read(contracts)) };
}
