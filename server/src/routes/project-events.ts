// GET /api/projects/:pid/events — ダッシュボードの最近の出来事 (spec/feature/project-dashboard.md)。読み取り専用。
import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import type { ProjectRole } from '../db/schema/project.ts';
import { versionRows } from '../db/spec-version-store.ts';
import { DASHBOARD_AUDIT_ACTIONS, mergeProjectEvents, parseEventLimit, type AuditEventRow, type FragmentEventRow, type VersionEventRow } from '../lib/project-events.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
export function makeProjectEventsRouter(): Hono {
  const r = new Hono();
  r.get('/', requireAuth, requireRole(ALL_ROLES), async (c) => {
    const pid = c.req.param('pid')!;
    const limit = parseEventLimit(c.req.query('limit'));
    const actions = Object.keys(DASHBOARD_AUDIT_ACTIONS);
    const [fragments, versions, audits] = await Promise.all([
      versionRows('SELECT id,content,source,created_by,created_at FROM spec_fragments WHERE project_id=? ORDER BY created_at DESC LIMIT ?', [pid, limit]),
      versionRows('SELECT id,version,kind,created_at FROM spec_version_logs WHERE project_id=? ORDER BY revision DESC LIMIT ?', [pid, limit]),
      versionRows(`SELECT id,action,target_kind,target_id,actor_display_name,actor_user_id,created_at FROM audit_log WHERE project_id=? AND action IN (${actions.map(() => '?').join(',')}) ORDER BY created_at DESC LIMIT ?`, [pid, ...actions, limit]),
    ]);
    const items = mergeProjectEvents({
      fragments: fragments as unknown as FragmentEventRow[], versions: versions as unknown as VersionEventRow[],
      audits: audits as unknown as AuditEventRow[], limit,
    });
    return c.json({ items, limit });
  });
  return r;
}
