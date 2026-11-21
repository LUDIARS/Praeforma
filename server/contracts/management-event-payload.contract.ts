import { createHash } from 'node:crypto';
import type { ContractOf } from './contract-types.ts';
import type { buildManagementEvent } from '../src/lib/management-event-payload.ts';

export default {
  post: (event, change) => event.source === 'pf'
    && event.event_key === `pf:${change.entity}:${createHash('sha256')
      .update(JSON.stringify([change.projectId, change.targetId, change.changeId])).digest('hex')}`
    && event.kind === `${change.entity}-${change.operation}`
    && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(event.project_code)
    && /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,199}$/.test(event.target_key)
    && event.origin === (change.origin ?? 'human')
    && event.observed_at === Date.parse(change.observedAt)
    && Number.isSafeInteger(event.observed_at) && event.observed_at >= 0
    && event.summary.length > 0 && event.summary.length <= 2000,
} satisfies ContractOf<typeof buildManagementEvent>;
