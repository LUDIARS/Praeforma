import { AppError } from './errors.ts';
export interface CcChatOptions { ccUrl: string | null; ccToken: string | null }
export interface CcChatSession {
  id: string; status: string; repo_path: string; started_at: number;
  metadata: Record<string, unknown>;
}
export interface CcChatMessage { id: number; author_type: string; content: string; ts: number }
export class CcChatClient {
  constructor(private readonly options: CcChatOptions, private readonly fetchImpl: typeof fetch = fetch) {}
  async request<T>(path: string, body?: unknown): Promise<T> {
    if (!this.options.ccUrl) throw new AppError('cc_unconfigured', 503);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await this.fetchImpl(`${this.options.ccUrl.replace(/\/+$/, '')}${path}`, {
        method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
        headers: { accept: 'application/json', 'content-type': 'application/json',
          ...(this.options.ccToken ? { authorization: `Bearer ${this.options.ccToken}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new AppError('cc_chat_failed', 502, { status: response.status });
      return await response.json() as T;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('cc_chat_unreachable', 502);
    } finally { clearTimeout(timer); }
  }
  async find(operation: string): Promise<CcChatSession | null> {
    for (let offset = 0; offset < 1000; offset += 100) {
      const result = await this.request<{ sessions: CcChatSession[] }>(`/v1/sessions?provider=claude&metadata=full&limit=100&offset=${offset}`);
      if (!Array.isArray(result.sessions)) throw new AppError('cc_chat_bad_payload', 502);
      const matches = result.sessions.filter(session => typeof session.metadata?.discord_startup_task === 'string'
        && session.metadata.discord_startup_task.includes(`[Pf-chat:${operation}]`));
      if (matches.length > 1) throw new AppError('cc_chat_ambiguous', 409);
      if (matches[0]) return matches[0];
      if (result.sessions.length < 100) break;
    }
    return null;
  }
  async resumeAnchor(id: string): Promise<string> {
    // Same Claude transcript anchor contract used by Cc's session fork UI.
    const result = await this.request<{ entries: Array<{ payload: Record<string, unknown> }> }>(
      `/v1/sessions/${encodeURIComponent(id)}/transcript?tail=1&limit=500`);
    if (!Array.isArray(result.entries)) throw new AppError('cc_chat_bad_payload', 502);
    const anchor = [...result.entries].reverse().map(entry => entry.payload?.claude_uuid)
      .find(value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value));
    if (typeof anchor !== 'string') throw AppError.conflict('chat_resume_anchor_unavailable');
    return anchor;
  }
}
