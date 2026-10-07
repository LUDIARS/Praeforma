import { randomUUID } from 'node:crypto';
import { readChat, saveChat, newChat } from '../db/llm-chat-store.ts';
import { versionRows } from '../db/spec-version-store.ts';
import { getDb } from '../db/connection.ts';
import { specFragments } from '../db/schema/spec-fragment.ts';
import { AppError } from './errors.ts';
import type { ConsultationRunner } from './consultation-runner.ts';
import type { ChatView, ChatMessage } from '../../../shared/llm-chat.ts';

/** Durable project/user conversation. Runner output is text, never an executable operation. */
export class LlmChatService {
  constructor(private readonly runner: ConsultationRunner, private readonly now: () => number = Date.now) {}

  async view(pid: string, uid: string): Promise<ChatView> {
    const { record } = await readChat(pid, uid);
    if (!record) return { state: 'empty', messages: [], lastActivity: 0 };
    const pending = record.backend === 'tool-less-v1' && record.state === 'sending';
    const state = pending ? (this.now() - record.startedAt < 150000 ? 'starting' : 'uncertain')
      : record.state === 'ready' || record.backend !== 'tool-less-v1' ? 'ready' : 'uncertain';
    return { state, messages: record.messages,
      lastActivity: record.messages.reduce((latest, message) => Math.max(latest, message.at), record.startedAt) };
  }

  async send(pid: string, uid: string, text: string): Promise<void> {
    const [project] = await versionRows('SELECT id FROM projects WHERE id=? AND deleted_at IS NULL', [pid]);
    if (!project) throw AppError.notFound('project_not_found');
    let stored = await readChat(pid, uid);
    const prior = stored.record;
    if (prior?.backend === 'tool-less-v1' && prior.state !== 'ready') throw AppError.conflict('chat_not_ready');
    const message: ChatMessage = { id: randomUUID(), role: 'user', text, at: this.now() };
    const record = { ...(prior ?? newChat(text, this.now())), backend: 'tool-less-v1' as const,
      cwd: null, sessions: [], state: 'sending' as const, startedAt: this.now(), operation: randomUUID(),
      messages: [...(prior?.messages ?? []), message] };
    // CAS persists the input before invoking the runner and prevents concurrent duplicate turns.
    stored = await saveChat(pid, uid, stored, record);
    try {
      await getDb().insert(specFragments).values({ id: message.id, projectId: pid, content: text,
        source: 'pf', sourceEventId: `llm-chat:${message.id}`, createdBy: uid }).onConflictDoNothing();
      const answer = await this.runner.reply(record.messages);
      await saveChat(pid, uid, stored, { ...record, state: 'ready', messages: [...record.messages,
        { id: randomUUID(), role: 'assistant', text: answer, at: this.now() }] });
    } catch (error) {
      await saveChat(pid, uid, stored, { ...record, state: 'uncertain' });
      throw error;
    }
  }

  async resume(pid: string, uid: string): Promise<void> {
    const stored = await readChat(pid, uid);
    const record = stored.record;
    if (!record) return;
    if (record.backend === 'tool-less-v1' && record.state === 'sending' && this.now() - record.startedAt < 150000) {
      throw AppError.conflict('chat_sending');
    }
    // Explicit recovery only unlocks the persisted conversation; it never replays a failed request.
    await saveChat(pid, uid, stored, { ...record, backend: 'tool-less-v1', cwd: null, sessions: [], state: 'ready' });
  }

  async clear(pid: string, uid: string): Promise<void> {
    const stored = await readChat(pid, uid);
    const record = stored.record;
    if (record?.backend === 'tool-less-v1' && record.state === 'sending' && this.now() - record.startedAt < 150000) {
      throw AppError.conflict('chat_operation_pending');
    }
    await saveChat(pid, uid, stored, null);
  }
}
