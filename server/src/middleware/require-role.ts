// requireRole — project_id を path param で受け取り、 認証済 user の project_member.role
// が許可セットに含まれるか確認する。 Step 2 の REST route から使う。
//
// 現段階 (Step 1) は型と中身のみ提供、 実装は project_members を引く必要がある
// ので DB 接続済前提。 DB 未接続時は internal error。

import type { MiddlewareHandler } from 'hono';
import { eq, and } from 'drizzle-orm';
import { getDb, getDbState } from '../db/connection.ts';
import { projectMembers, type ProjectRole } from '../db/schema/project.ts';
import { AppError } from '../lib/errors.ts';
import { getIdentity } from './require-auth.ts';

export function requireRole(allowed: readonly ProjectRole[]): MiddlewareHandler {
  const set = new Set<ProjectRole>(allowed);
  return async (c, next) => {
    const state = getDbState();
    if (!state.ok) throw AppError.internal('db_unavailable');
    const projectId = c.req.param('pid') ?? c.req.param('projectId');
    if (!projectId) throw AppError.badRequest('project_id missing in path');
    const id = getIdentity(c);
    const rows = await getDb()
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, id.userId),
        ),
      )
      .limit(1);
    const role = rows[0]?.role as ProjectRole | undefined;
    if (!role || !set.has(role)) throw AppError.forbidden('role_required');
    c.set('projectRole', role);
    await next();
  };
}

declare module 'hono' {
  interface ContextVariableMap {
    projectRole: ProjectRole;
  }
}
