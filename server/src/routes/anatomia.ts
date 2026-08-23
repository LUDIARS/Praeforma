// /api/projects/:pid/anatomia — Anatomia (正本) のドメイン一覧と Praeforma ドメインの突合
// (feature/screen-flow.md §4.1)。
//
//   GET  /domains  … Anatomia 一覧 + 各 Praeforma ドメインの突合結果 (exact / candidates)
//   POST /match    … 同名一致のものに anatomia_domain を自動で埋める (上書きしない)
//
// @spec 4.1 正本と突合

import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { getDb, getDbState } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { domains } from '../db/schema/domain.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import {
  fetchAnatomiaDomains,
  matchDomain,
  type AnatomiaDomain,
  type AnatomiaDomainsOptions,
} from '../lib/anatomia-domains.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

async function loadCatalog(opts: AnatomiaDomainsOptions, pid: string): Promise<{ repo: string; catalog: AnatomiaDomain[] }> {
  const [project] = await getDb().select().from(projects).where(eq(projects.id, pid)).limit(1);
  if (!project) throw AppError.notFound('project_not_found');
  if (!project.anatomiaRepo) throw new AppError('anatomia_repo_unset', 409);
  const catalog = await fetchAnatomiaDomains(opts, project.anatomiaRepo);
  return { repo: project.anatomiaRepo, catalog };
}

export function makeAnatomiaRouter(opts: AnatomiaDomainsOptions): Hono {
  const r = new Hono();

  r.get('/domains', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const { repo, catalog } = await loadCatalog(opts, pid);
    const rows = await getDb().select().from(domains).where(eq(domains.projectId, pid)).orderBy(asc(domains.name));
    const matches = rows.map((d) => {
      const m = d.anatomiaDomain ? { exact: d.anatomiaDomain, candidates: [] } : matchDomain(d.name, catalog);
      return {
        domain_id: d.id,
        name: d.name,
        anatomia_domain: d.anatomiaDomain,
        linked: Boolean(d.anatomiaDomain),
        exact: m.exact,
        candidates: m.candidates,
      };
    });
    return c.json({ repo, catalog, matches });
  });

  r.post('/match', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const { catalog } = await loadCatalog(opts, pid);
    const rows = await getDb().select().from(domains).where(eq(domains.projectId, pid));
    const linked: Array<{ domain_id: string; anatomia_domain: string }> = [];
    for (const d of rows) {
      if (d.anatomiaDomain) continue;
      const m = matchDomain(d.name, catalog);
      if (!m.exact) continue;
      await getDb().update(domains).set({ anatomiaDomain: m.exact, updatedAt: new Date() }).where(eq(domains.id, d.id));
      linked.push({ domain_id: d.id, anatomia_domain: m.exact });
    }
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'domain.anatomia_match',
      targetKind: 'project',
      targetId: pid,
      meta: { linked },
    });
    return c.json({ linked });
  });

  return r;
}
