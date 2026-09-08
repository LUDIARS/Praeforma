import { randomUUID } from 'node:crypto';
import { versionBatch, versionRows } from './spec-version-store.ts';
import type { ChatMessage } from '../../../shared/llm-chat.ts';
import { AppError } from '../lib/errors.ts';

export interface ChatRecord {
  id: string; operation: string; cwd: string | null; sessions: string[];
  state: 'starting' | 'ready' | 'sending' | 'uncertain';
  startedAt: number; messages: ChatMessage[];
}
export interface StoredChat { revision: number; record: ChatRecord | null }
export async function readChat(pid: string, uid: string): Promise<StoredChat> {
  // This insert intentionally returns no rows; SQLite must execute it with run(), not all().
  await versionBatch([{ sql: 'INSERT INTO llm_chats(project_id,user_id,revision,data) VALUES(?,?,0,NULL) ON CONFLICT(project_id,user_id) DO NOTHING', args: [pid, uid] }]);
  const [row] = await versionRows('SELECT revision,data FROM llm_chats WHERE project_id=? AND user_id=?', [pid, uid]);
  if (!row) throw AppError.internal('chat_storage_unavailable');
  return { revision: Number(row.revision), record: row.data === null ? null : JSON.parse(String(row.data)) as ChatRecord };
}
export async function saveChat(pid: string, uid: string, previous: StoredChat, record: ChatRecord | null): Promise<StoredChat> {
  const rows = await versionRows('UPDATE llm_chats SET revision=revision+1,data=? WHERE project_id=? AND user_id=? AND revision=? RETURNING revision',
    [record ? JSON.stringify(record) : null, pid, uid, previous.revision]);
  if (!rows.length) throw AppError.conflict('chat_changed');
  return { revision: Number(rows[0]!.revision), record };
}
export function newChat(text: string, now: number): ChatRecord {
  return { id: randomUUID(), operation: randomUUID(), cwd: null, sessions: [], state: 'starting', startedAt: now,
    messages: [{ id: randomUUID(), role: 'user', text, at: now }] };
}
