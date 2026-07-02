// /ws/edit?project=<pid> — リアルタイム edit_ops broadcast + presence cursor。
//
// プロトコル (JSON):
//   client → server:
//     { type: "auth", token: "<PASETO>" }            (= 接続直後 1 回必須)
//     { type: "cursor", payload: {...} }             (= プレゼンス cursor 更新)
//     { type: "op", op, target_kind, target_id, payload, prev_version? }
//                                                    (= edit 操作の broadcast 依頼)
//     { type: "pong", ts }
//   server → client:
//     { type: "hello", session_id }                  (= 接続確立)
//     { type: "ping", ts }                           (= 30s ごと、 client は 10s 以内 pong)
//     { type: "presence", users: [{user_id, display_name, cursor}] }
//     { type: "op", op, target_kind, target_id, payload, user_id, created_at, id }
//     { type: "error", code, message }
//
// 認可:
//   - auth 成功後に project_members を検証 (= REST requireRole と同じ gate)。
//     member でなければ close 4003、 DB down で判定不能なら fail-close (close 1013)。
//   - op は WRITE_ROLES (owner/planner/designer) のみ。 それ以外は error を返し接続維持。
//
// 同一 project 内の他 peer に broadcast。 op は edit_ops テーブルに INSERT して
// グローバル順序 (= bigserial id) を付ける。 楽観ロック対象 (= spec.version 等)
// は prev_version を含む op に対して CAS を実装するのが理想だが、 v1 では
// 受け取り → broadcast のみ (= 競合は REST 側 PATCH で 409 を出す責務)。

import { WebSocketServer, type WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import { ulid } from 'ulid';
import { and, eq } from 'drizzle-orm';
import { getDb, getDbState } from '../db/connection.ts';
import { editSessions, editOps } from '../db/schema/collab.ts';
import { projectMembers, type ProjectRole } from '../db/schema/project.ts';
import { verifyPaseto, type AuthIdentity } from '../auth/paseto.ts';

// REST 側 (routes/*) の role モデルと同じ考え方:
//   - 接続 (presence / cursor / op 受信) は member なら全 role 可
//   - op 送信 (= 書き込み) は REST の EDIT_ROLES ∪ TRANSFORM_ROLES ∪ UPLOAD_ROLES
//     に合わせて owner / planner / designer のみ (reviewer / viewer は read-only)
const WRITE_ROLES: ReadonlySet<ProjectRole> = new Set(['owner', 'planner', 'designer']);

interface Peer {
  sessionId: string;
  projectId: string;
  identity: AuthIdentity;
  role: ProjectRole;
  ws: WebSocket;
  cursor: Record<string, unknown> | null;
  alive: boolean;
}

const projectsToPeers = new Map<string, Set<Peer>>();

function broadcastPresence(projectId: string): void {
  const peers = projectsToPeers.get(projectId);
  if (!peers) return;
  const users = Array.from(peers).map((p) => ({
    user_id: p.identity.userId,
    display_name: p.identity.displayName,
    session_id: p.sessionId,
    cursor: p.cursor,
  }));
  const msg = JSON.stringify({ type: 'presence', users });
  for (const p of peers) {
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(msg);
  }
}

function broadcastOp(
  projectId: string,
  exceptSession: string | null,
  payload: Record<string, unknown>,
): void {
  const peers = projectsToPeers.get(projectId);
  if (!peers) return;
  const msg = JSON.stringify({ type: 'op', ...payload });
  for (const p of peers) {
    if (p.sessionId === exceptSession) continue;
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(msg);
  }
}

function safeSend(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

// project membership を引く (= REST middleware/require-role.ts と同じ判定)。
// DB が引けない場合は認可判定不能 = fail-close にするため 'unavailable' を返す。
async function lookupMemberRole(
  projectId: string,
  userId: string,
): Promise<ProjectRole | null | 'unavailable'> {
  if (!getDbState().ok) return 'unavailable';
  try {
    const rows = await getDb()
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      )
      .limit(1);
    return (rows[0]?.role as ProjectRole | undefined) ?? null;
  } catch (e) {
    console.warn('[collab] membership lookup failed:', (e as Error).message);
    return 'unavailable';
  }
}

export function attachCollab(httpServer: HttpServer): void {
  // path で /ws/edit のみ受ける
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url ?? '', 'http://localhost');
      if (!url.pathname.startsWith('/ws/edit')) return;
      const projectId = url.searchParams.get('project');
      if (!projectId) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, projectId);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, _req: unknown, projectId: string) => {
    let peer: Peer | null = null;
    let pingTimer: NodeJS.Timeout | null = null;

    ws.on('message', async (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        safeSend(ws, { type: 'error', code: 'bad_json', message: 'invalid json' });
        return;
      }

      // 接続後最初の auth で identity を確定
      if (!peer) {
        if (msg.type !== 'auth' || typeof msg.token !== 'string') {
          safeSend(ws, { type: 'error', code: 'auth_required', message: 'send auth first' });
          ws.close(4001, 'auth_required');
          return;
        }
        const identity = await verifyPaseto(msg.token);
        if (!identity) {
          safeSend(ws, { type: 'error', code: 'invalid_token', message: 'PASETO invalid' });
          ws.close(4002, 'invalid_token');
          return;
        }
        // project membership 検証 (REST requireRole と同じ gate)。
        // ローカルモードは attachCollab 自体を起動しない (index.ts) ため、
        // ここに来るのは常に Cernere PASETO + Postgres 構成。
        // DB down 中は認可判定ができないので fail-close (= 接続拒否)。
        const memberRole = await lookupMemberRole(projectId, identity.userId);
        if (memberRole === 'unavailable') {
          safeSend(ws, {
            type: 'error',
            code: 'db_unavailable',
            message: 'membership check unavailable',
          });
          ws.close(1013, 'db_unavailable');
          return;
        }
        if (!memberRole) {
          safeSend(ws, {
            type: 'error',
            code: 'forbidden',
            message: 'not a member of this project',
          });
          ws.close(4003, 'forbidden');
          return;
        }
        const sessionId = ulid();
        peer = {
          sessionId,
          projectId,
          identity,
          role: memberRole,
          ws,
          cursor: null,
          alive: true,
        };
        // peer 登録 + DB に session 記録
        if (!projectsToPeers.has(projectId)) projectsToPeers.set(projectId, new Set());
        projectsToPeers.get(projectId)!.add(peer);
        if (getDbState().ok) {
          try {
            await getDb()
              .insert(editSessions)
              .values({
                id: sessionId,
                projectId,
                userId: identity.userId,
                clientKind: 'web',
              });
          } catch (e) {
            console.warn('[collab] edit_session insert failed:', (e as Error).message);
          }
        }
        safeSend(ws, { type: 'hello', session_id: sessionId });
        broadcastPresence(projectId);

        // 30s ping
        pingTimer = setInterval(() => {
          if (!peer) return;
          if (!peer.alive) {
            ws.terminate();
            return;
          }
          peer.alive = false;
          safeSend(ws, { type: 'ping', ts: Date.now() });
        }, 30_000);
        pingTimer.unref?.();
        return;
      }

      if (msg.type === 'pong') {
        peer.alive = true;
        return;
      }

      if (msg.type === 'cursor') {
        peer.cursor = (msg.payload as Record<string, unknown>) ?? null;
        broadcastPresence(projectId);
        return;
      }

      if (msg.type === 'op') {
        // 書き込み role gate: reviewer / viewer 等は op 拒否 (接続は維持)。
        if (!WRITE_ROLES.has(peer.role)) {
          safeSend(ws, {
            type: 'error',
            code: 'forbidden',
            message: 'role not allowed to send ops',
          });
          return;
        }
        const op = typeof msg.op === 'string' ? msg.op : null;
        const targetKind = typeof msg.target_kind === 'string' ? msg.target_kind : null;
        const targetId = typeof msg.target_id === 'string' ? msg.target_id : null;
        if (!op || !targetKind || !targetId) {
          safeSend(ws, { type: 'error', code: 'bad_op', message: 'op/target_kind/target_id required' });
          return;
        }
        const payload = (msg.payload as Record<string, unknown>) ?? {};
        const prevVersion = typeof msg.prev_version === 'number' ? msg.prev_version : null;

        // edit_ops に INSERT (失敗しても broadcast は続行)
        let id: number | null = null;
        let createdAt: string | null = null;
        if (getDbState().ok) {
          try {
            const [row] = await getDb()
              .insert(editOps)
              .values({
                projectId,
                sessionId: peer.sessionId,
                userId: peer.identity.userId,
                op,
                targetKind,
                targetId,
                payload,
                prevVersion: prevVersion ?? null,
              })
              .returning({ id: editOps.id, createdAt: editOps.createdAt });
            if (row) {
              id = row.id;
              createdAt = row.createdAt.toISOString();
            }
          } catch (e) {
            console.warn('[collab] edit_op insert failed:', (e as Error).message);
          }
        }

        broadcastOp(projectId, peer.sessionId, {
          id,
          op,
          target_kind: targetKind,
          target_id: targetId,
          payload,
          prev_version: prevVersion,
          user_id: peer.identity.userId,
          session_id: peer.sessionId,
          created_at: createdAt,
        });
        return;
      }
    });

    ws.on('close', async () => {
      if (!peer) return;
      const peers = projectsToPeers.get(peer.projectId);
      peers?.delete(peer);
      if (peers && peers.size === 0) projectsToPeers.delete(peer.projectId);
      if (pingTimer) clearInterval(pingTimer);
      if (getDbState().ok) {
        try {
          await getDb()
            .update(editSessions)
            .set({ disconnectedAt: new Date() })
            .where(eq(editSessions.id, peer.sessionId));
        } catch (e) {
          console.warn('[collab] edit_session close update failed:', (e as Error).message);
        }
      }
      broadcastPresence(peer.projectId);
    });
  });

  console.log('[collab] WebSocket attached at /ws/edit');
}
