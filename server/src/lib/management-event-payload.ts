// @spec ペイロードと配送
import { createHash } from 'node:crypto';
import { contract } from '@ludiars/log-weaver'; /* augur-inject:import:dc0b232d */
import augurContract_6f211da8 from '../../contracts/management-event-payload.contract.ts'; /* augur-inject:contract-predicate:2cf399fe */

const summaries = {
  spec: {
    created: '仕様を追加しました。',
    updated: '仕様を更新しました。',
    deleted: '仕様を削除しました。',
  },
  scene: {
    created: 'シーンを追加しました。',
    updated: 'シーン設計を更新しました。',
    deleted: 'シーンを削除しました。',
  },
  domain: {
    created: 'ドメインを追加しました。',
    updated: 'ドメイン定義または関連付けを更新しました。',
    deleted: 'ドメインを削除しました。',
  },
} as const;

export interface ManagementChange {
  entity: keyof typeof summaries;
  operation: keyof typeof summaries.spec;
  projectId: string;
  targetId: string;
  changeId: string;
  observedAt: string;
  origin?: 'human' | 'ai' | 'system';
}

export interface ManagementEvent {
  event_key: string;
  source: 'pf';
  kind: string;
  project_code: string;
  target_key: string;
  origin: NonNullable<ManagementChange['origin']>;
  summary: string;
  observed_at: number;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function buildManagementEvent(change: ManagementChange): ManagementEvent {
  const { projectId, targetId, changeId, entity, operation } = change;
  const observedAt = Date.parse(change.observedAt);
  if (!Number.isSafeInteger(observedAt) || observedAt < 0) throw new Error('invalid_management_event_time');
  return {
    event_key: `pf:${entity}:${digest(JSON.stringify([projectId, targetId, changeId]))}`,
    source: 'pf',
    kind: `${entity}-${operation}`,
    project_code: /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(projectId) ? projectId : `pf-${digest(projectId).slice(0, 32)}`,
    target_key: `${entity}/${/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(targetId) ? targetId : digest(targetId)}`,
    origin: change.origin ?? 'human',
    summary: summaries[entity][operation],
    observed_at: observedAt,
  };
}
// @ts-expect-error augur-inject
buildManagementEvent = contract(buildManagementEvent, { ...augurContract_6f211da8, contractId: 'C-12', mode: 'observe', sample: 1, where: 'server/src/lib/management-event-payload.ts:46', rule: 'contract-wrap', id: '6f211da8' }); /* augur-inject:contract-wrap:6f211da8 */
