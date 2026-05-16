// audit_log への書込み helper。
// 破壊的操作 (create / update / delete / role 変更等) を呼ぶ side に
// `await recordAudit(...)` を 1 行足すだけで監査ログが残るようにする。
//
// 失敗しても route の正常応答は壊さない (= log + 続行)。

import { getDb, getDbState } from '../db/connection.ts';
import { auditLog } from '../db/schema/collab.ts';
import type { AuthIdentity } from '../auth/paseto.ts';

export interface AuditEntry {
  projectId: string;
  actor: AuthIdentity;
  action: string;
  targetKind?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  if (!getDbState().ok) return;
  try {
    await getDb()
      .insert(auditLog)
      .values({
        projectId: entry.projectId,
        actorUserId: entry.actor.userId,
        actorDisplayName: entry.actor.displayName,
        action: entry.action,
        targetKind: entry.targetKind ?? null,
        targetId: entry.targetId ?? null,
        meta: entry.meta ?? {},
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[audit] failed to record ${entry.action}: ${msg}`);
  }
}
