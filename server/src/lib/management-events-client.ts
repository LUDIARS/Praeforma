// @spec ペイロードと配送
import type { ManagementEvent } from './management-event-payload.ts';
import { contract } from '@ludiars/log-weaver'; /* augur-inject:import:fe2e13db */
import augurContract_249f0d81 from '../../contracts/management-event-status.contract.ts'; /* augur-inject:contract-predicate:38f34691 */
import augurContract_608575ac from '../../contracts/management-events-url.contract.ts'; /* augur-inject:contract-predicate:6a64148d */

export type ManagementEventDelivery = 'delivered' | 'refused' | 'retry';

export function resolveManagementEventsUrl(env: NodeJS.ProcessEnv): string | null {
  const explicit = env.CONCORDIA_MANAGEMENT_EVENTS_URL?.trim();
  const configured = explicit || env.CONCORDIA_URL?.trim();
  if (!configured || configured.toLowerCase() === 'off') return null;
  const url = new URL(configured);
  const loopback = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))
    || url.username || url.password || url.hash || url.search) {
    throw new Error('invalid_management_events_url');
  }
  return explicit ? url.href : new URL('/v1/management/events', url).href;
}
// @ts-expect-error augur-inject
resolveManagementEventsUrl = contract(resolveManagementEventsUrl, { ...augurContract_608575ac, contractId: 'C-14', mode: 'observe', sample: 1, where: 'server/src/lib/management-events-client.ts:5', rule: 'contract-wrap', id: '608575ac' }); /* augur-inject:contract-wrap:608575ac */

export function classifyManagementEventStatus(status: number): ManagementEventDelivery {
  if (status >= 200 && status < 300) return 'delivered';
  if (status >= 400 && status < 500) return 'refused';
  return 'retry';
}
// @ts-expect-error augur-inject
classifyManagementEventStatus = contract(classifyManagementEventStatus, { ...augurContract_249f0d81, contractId: 'C-13', mode: 'observe', sample: 1, where: 'server/src/lib/management-events-client.ts:18', rule: 'contract-wrap', id: '249f0d81' }); /* augur-inject:contract-wrap:249f0d81 */

export async function postManagementEvent(
  url: string,
  event: ManagementEvent,
  fetcher: typeof fetch,
  shutdown: AbortSignal,
): Promise<ManagementEventDelivery> {
  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      redirect: 'manual',
      signal: AbortSignal.any([shutdown, AbortSignal.timeout(5000)]),
    });
    const result = classifyManagementEventStatus(response.status);
    // The receiver's status is known even if the unused body cannot be cancelled.
    await response.body?.cancel().catch(() => {});
    return result;
  } catch {
    // A timeout or disconnected peer can leave the receipt unknown. Retry the same event.
    return 'retry';
  }
}
