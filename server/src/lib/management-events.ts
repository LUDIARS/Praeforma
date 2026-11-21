// @spec ペイロードと配送
import { buildManagementEvent, type ManagementChange } from './management-event-payload.ts';
import { postManagementEvent, resolveManagementEventsUrl } from './management-events-client.ts';
import { ManagementEventQueue } from './management-event-queue.ts';

let queue: ManagementEventQueue | undefined;

function warn(message: string): void {
  console.warn(`[cc-management-events] ${message}`);
}

export function startManagementEvents(env: NodeJS.ProcessEnv = process.env, fetcher = fetch): () => void {
  let url: string | null;
  try {
    url = resolveManagementEventsUrl(env);
  } catch {
    warn('invalid Concordia management events URL; delivery disabled');
    return () => {};
  }
  if (!url) return () => {};
  const destination = url;
  const active = new ManagementEventQueue((event, signal) => postManagementEvent(destination, event, fetcher, signal), warn);
  queue?.close();
  queue = active;
  return () => {
    active.close();
    if (queue === active) queue = undefined;
  };
}

export function isManagementEventsEnabled(): boolean {
  return queue !== undefined;
}

/** Called by save paths after persistence. Enqueueing cannot affect the original response. */
export function publishManagementChange(change: Omit<ManagementChange, 'observedAt'> & { observedAt?: string }): void {
  if (!queue) return;
  try {
    queue.enqueue(buildManagementEvent({ ...change, observedAt: change.observedAt ?? new Date().toISOString() }));
  } catch {
    warn('could not enqueue a saved change');
  }
}
