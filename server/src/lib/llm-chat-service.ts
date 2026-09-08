import { randomUUID } from 'node:crypto';
import { CcChatClient, type CcChatSession, type CcChatMessage } from './cc-chat-client.ts';
import { readChat, saveChat, newChat, type StoredChat, type ChatRecord } from '../db/llm-chat-store.ts';
import { versionRows } from '../db/spec-version-store.ts';
import { getDb } from '../db/connection.ts';
import { specFragments } from '../db/schema/spec-fragment.ts';
import { AppError } from './errors.ts';
import type { ChatView, ChatMessage } from '../../../shared/llm-chat.ts';

/** One durable conversation per project/user; only its server-bound Cc sessions are exposed. */
export class LlmChatService {
  constructor(private readonly cc: CcChatClient, private readonly now: () => number = Date.now) {}
  private async discover(pid: string, uid: string, stored: StoredChat): Promise<StoredChat> {
    const record = stored.record;
    if (!record || record.state !== 'starting') return stored;
    const session = await this.cc.find(record.operation);
    if (!session) return stored;
    if (record.cwd && session.repo_path.replace(/\\/g, '/').toLowerCase() !== record.cwd.replace(/\\/g, '/').toLowerCase()) {
      throw AppError.conflict('cc_chat_scope_mismatch');
    }
    return saveChat(pid, uid, stored, { ...record, cwd: session.repo_path, sessions: [...record.sessions, session.id], state: 'ready' });
  }
  /** Cc session lookup that reports an unreadable session as absent rather than failing the view. */
  private async session(id: string): Promise<CcChatSession | null> {
    try {
      return (await this.cc.request<{ session: CcChatSession }>(`/v1/sessions/${encodeURIComponent(id)}`)).session ?? null;
    } catch (error) {
      if (error instanceof AppError && error.status === 502) return null;
      throw error;
    }
  }
  async view(pid: string, uid: string): Promise<ChatView> {
    const stored = await this.discover(pid, uid, await readChat(pid, uid));
    const record = stored.record;
    if (!record) return { state: 'empty', messages: [], lastActivity: 0 };
    const messages: ChatMessage[] = [...record.messages];
    // A session Cc has already pruned must not hide the persisted conversation: skip it and
    // let the state fall through to 'ended' so the reconnect path stays reachable.
    let reachable = true;
    for (const id of record.sessions) {
      let result: { messages: CcChatMessage[] };
      try {
        result = await this.cc.request<{ messages: CcChatMessage[] }>(`/v1/sessions/${encodeURIComponent(id)}/messages?limit=100`);
      } catch (error) {
        if (!(error instanceof AppError) || error.status !== 502) throw error;
        reachable = false; continue;
      }
      if (!Array.isArray(result.messages)) throw new AppError('cc_chat_bad_payload', 502);
      for (const message of result.messages) {
        if (message.author_type === 'assistant' || message.author_type === 'question' || message.author_type === 'permission') {
          messages.push({ id: `${id}:${message.id}`, role: message.author_type === 'assistant' ? 'assistant' : 'system', text: message.content, at: message.ts * 1000 });
        }
      }
    }
    const current = record.sessions.at(-1);
    const session = current && reachable ? await this.session(current) : null;
    const state = record.state === 'starting' ? (this.now() - record.startedAt > 120000 ? 'uncertain' : 'starting') : record.state !== 'ready' ? 'uncertain'
      : session?.status === 'active' ? 'ready' : 'ended';
    messages.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    return { state, messages, lastActivity: messages.reduce((latest, message) => Math.max(latest, message.at), record.startedAt) };
  }
  private async fragment(pid: string, uid: string, message: ChatMessage): Promise<void> {
    await getDb().insert(specFragments).values({ id: message.id, projectId: pid, content: message.text,
      source: 'pf', sourceEventId: `llm-chat:${message.id}`, createdBy: uid }).onConflictDoNothing();
  }
  /** Project name reaches Cc as a worktree/project identifier, so it stays restricted on every spawn path. */
  private async projectName(pid: string): Promise<string> {
    const [project] = await versionRows('SELECT name FROM projects WHERE id=? AND deleted_at IS NULL', [pid]);
    if (!project) throw AppError.notFound('project_not_found');
    const name = String(project.name);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) throw AppError.conflict('chat_project_name_invalid');
    return name;
  }
  private async spawn(pid: string, uid: string, stored: StoredChat, resumeAnchor: string | null): Promise<void> {
    const record = stored.record!;
    const name = await this.projectName(pid);
    const text = resumeAnchor ? '保存されている会話を再開してください。次の利用者の入力を待ってください。' : record.messages[0]!.text;
    const response = await this.cc.request<{ ok: boolean; cwd: string }>('/v1/admin/spawn-session', {
      provider: 'claude', mode: 'tab', title: `Pf AI相談: ${name}`,
      ...(resumeAnchor ? { cwd: record.cwd, worktree: false } : { project: name, worktree: true }),
      args: resumeAnchor ? ['--resume', resumeAnchor] : [],
      prompt: `[Pf-chat:${record.operation}]\nPf内の仕様・設計相談です。利用者の明示指示なしに実装・変更・送信をしないでください。会話の応答後は次の入力を待ち、自分で/session-endやclearを実行しないでください。\n${text}`,
    });
    if (!response.ok || typeof response.cwd !== 'string') throw new AppError('cc_chat_bad_payload', 502);
    await saveChat(pid, uid, stored, { ...record, cwd: response.cwd });
  }
  async send(pid: string, uid: string, text: string): Promise<void> {
    let stored = await this.discover(pid, uid, await readChat(pid, uid));
    if (!stored.record) {
      await this.projectName(pid); // Fail before persisting a record we could never spawn.
      const record = newChat(text, this.now());
      stored = await saveChat(pid, uid, stored, record);
      try { await this.fragment(pid, uid, record.messages[0]!); }
      catch (error) { await saveChat(pid, uid, stored, { ...record, state: 'uncertain' }); throw error; }
      // Persist before spawn: a timeout must never cause an automatic duplicate session.
      try { await this.spawn(pid, uid, stored, null); }
      catch (error) {
        // Explicit 4xx rejection means no child was started. Transport uncertainty stays pending.
        const status = error instanceof AppError ? (error.detail as { status?: number } | undefined)?.status : undefined;
        if (status && status >= 400 && status < 500) await saveChat(pid, uid, stored, { ...record, state: 'uncertain' });
        throw error;
      }
      return;
    }
    const record = stored.record;
    if (record.state !== 'ready') throw AppError.conflict('chat_not_ready');
    const current = record.sessions.at(-1)!;
    const { session } = await this.cc.request<{ session: CcChatSession }>(`/v1/sessions/${encodeURIComponent(current)}`);
    if (session.status !== 'active') throw AppError.conflict('chat_resume_required');
    const message: ChatMessage = { id: randomUUID(), role: 'user', text, at: this.now() };
    stored = await saveChat(pid, uid, stored, { ...record, state: 'sending', messages: [...record.messages, message] });
    try {
      await this.fragment(pid, uid, message);
      const result = await this.cc.request<{ ok: boolean }>(`/v1/sessions/${encodeURIComponent(current)}/inject`, { text, source: 'pf-chat' });
      if (!result.ok) throw new AppError('cc_chat_failed', 502);
      await saveChat(pid, uid, stored, { ...stored.record!, state: 'ready' });
    } catch (error) {
      await saveChat(pid, uid, stored, { ...stored.record!, state: 'uncertain' });
      throw error;
    }
  }
  async resume(pid: string, uid: string): Promise<void> {
    let stored = await this.discover(pid, uid, await readChat(pid, uid));
    const record = stored.record;
    if (!record) return;
    if (record.state === 'starting') throw AppError.conflict('chat_starting');
    const current = record.sessions.at(-1);
    if (!current) throw AppError.conflict('chat_session_unknown');
    const { session } = await this.cc.request<{ session: CcChatSession }>(`/v1/sessions/${encodeURIComponent(current)}`);
    if (session.status === 'active') {
      if (record.state === 'sending' && this.now() - (record.messages.at(-1)?.at ?? 0) < 45000) throw AppError.conflict('chat_sending');
      if (record.state !== 'ready') await saveChat(pid, uid, stored, { ...record, state: 'ready' });
      return;
    }
    if (!record.cwd || session.status === 'lost') throw AppError.conflict('chat_session_unavailable');
    const anchor = await this.cc.resumeAnchor(current);
    stored = await saveChat(pid, uid, stored, { ...record, state: 'starting', operation: randomUUID(), startedAt: this.now() });
    await this.spawn(pid, uid, stored, anchor);
  }
  async clear(pid: string, uid: string): Promise<void> {
    let stored = await this.discover(pid, uid, await readChat(pid, uid));
    if (stored.record?.state === 'starting' || stored.record?.state === 'sending') throw AppError.conflict('chat_operation_pending');
    const record = stored.record;
    if (record) {
      stored = await saveChat(pid, uid, stored, { ...record, state: 'sending' });
      try {
        for (const id of record.sessions) {
          const { session } = await this.cc.request<{ session: CcChatSession }>(`/v1/sessions/${encodeURIComponent(id)}`);
          if (session.status === 'active' || session.status === 'lost') {
            const result = await this.cc.request<{ ok: boolean }>(`/v1/admin/stop-session/${encodeURIComponent(id)}`, {});
            if (!result.ok) throw new AppError('cc_chat_stop_failed', 502);
          }
        }
      } catch (error) { await saveChat(pid, uid, stored, { ...record, state: 'uncertain' }); throw error; }
    }
    // Cc/provider audit history is retained; only explicit Clear removes the active Pf binding.
    await saveChat(pid, uid, stored, null);
  }
}
