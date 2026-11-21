// @spec ペイロードと配送
import type { ManagementEvent } from './management-event-payload.ts';
import type { ManagementEventDelivery } from './management-events-client.ts';

const MAX_PENDING = 1000;
const RETRY_INITIAL_MS = 5000;
const RETRY_MAX_MS = 5 * 60_000;

interface PendingEvent {
  event: ManagementEvent;
  readyAt: number;
  retryDelay: number;
}

export class ManagementEventQueue {
  private readonly pending = new Map<string, PendingEvent>();
  private readonly shutdown = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private sending = false;

  constructor(
    private readonly send: (event: ManagementEvent, signal: AbortSignal) => Promise<ManagementEventDelivery>,
    private readonly warn: (message: string) => void,
  ) {}

  enqueue(event: ManagementEvent): void {
    if (this.shutdown.signal.aborted || this.pending.has(event.event_key)) return;
    if (this.pending.size >= MAX_PENDING) {
      this.warn('queue is full; a management event was dropped');
      return;
    }
    this.pending.set(event.event_key, { event, readyAt: Date.now(), retryDelay: RETRY_INITIAL_MS });
    this.schedule();
  }

  close(): void {
    this.shutdown.abort();
    clearTimeout(this.timer);
    this.pending.clear();
  }

  private schedule(): void {
    if (this.sending || this.shutdown.signal.aborted || !this.pending.size) return;
    clearTimeout(this.timer);
    let next: PendingEvent | undefined;
    for (const entry of this.pending.values()) {
      if (!next || entry.readyAt < next.readyAt) next = entry;
    }
    if (!next) return;
    const entry = next;
    this.timer = setTimeout(() => {
      void this.deliver(entry);
    }, Math.max(0, entry.readyAt - Date.now()));
    this.timer.unref();
  }

  private async deliver(entry: PendingEvent): Promise<void> {
    this.sending = true;
    try {
      const result = await this.send(entry.event, this.shutdown.signal);
      if (this.shutdown.signal.aborted) return;
      if (result === 'retry') {
        entry.readyAt = Date.now() + entry.retryDelay;
        entry.retryDelay = Math.min(entry.retryDelay * 2, RETRY_MAX_MS);
        return;
      }
      this.pending.delete(entry.event.event_key);
      if (result === 'refused') this.warn('Concordia refused a management event');
    } finally {
      this.sending = false;
      this.schedule();
    }
  }
}
