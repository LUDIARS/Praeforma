// /api/projects/:pid/domain-definitions — ドメインの価値定義と
// 要件 / シーン定義 / Anatomia への関連付け (spec/feature/domain-definition-links.md)。
//
// role:
//   - get: viewer 以上 (プロジェクトメンバー)
//   - put: owner / planner
// PF-DL-INV1 (露出不足で保存を拒否しない) / PF-DL-INV3 (参照先のプロジェクト照合) /
// PF-DL-INV4 (版一致で保存) / PF-DL-INV5 (既存ドメインは分類未定義のまま保持)。

import { Hono } from 'hono';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, getDbState } from '../db/connection.ts';
import { domains } from '../db/schema/domain.ts';
import { layouts } from '../db/schema/layout.ts';
import { projects } from '../db/schema/project.ts';
import { specs, specTargets } from '../db/schema/spec.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { domainDefinitionSchema } from '../lib/domain-definition.ts';
import { saveDomainDefinition } from '../db/domain-definition-persistence.ts';
import { fetchAnatomiaDomains, type AnatomiaDomainsOptions } from '../lib/anatomia-domains.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { assignBusinessDomain, assignBusinessDomains, readMemberships } from '../db/domain-assignment.ts';
import { z } from 'zod';
import { bodyLimit } from 'hono/body-limit';

export function makeDomainDefinitionsRouter(options: AnatomiaDomainsOptions): Hono {
  const r = new Hono();
  r.use('*', requireAuth, requireRole(['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer']));
  r.get('/', async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const items = await getDb().select().from(domains).where(eq(domains.projectId, pid));
    const scenes = await getDb().select({ id: layouts.id, name: layouts.name }).from(layouts)
      .where(and(eq(layouts.projectId, pid), isNull(layouts.deletedAt)));
    const requirements = await getDb().select({ id: specs.id, code: specs.code, title: specs.title }).from(specs)
      .where(and(eq(specs.projectId, pid), isNull(specs.deletedAt)));
    const links = await getDb().select({ specId: specTargets.specId, domainId: specTargets.refId }).from(specTargets)
      .innerJoin(specs, eq(specTargets.specId, specs.id))
      .where(and(eq(specs.projectId, pid), isNull(specs.deletedAt), eq(specTargets.kind, 'domain')));
    return c.json({ items, scenes, requirements, links, memberships: await readMemberships(pid) });
  });
  r.post('/:did/business-domains', requireRole(['owner', 'planner']), bodyLimit({ maxSize: 16384 }), async (c) => {
    const parsed = z.object({ businessIds: z.array(z.string().min(1).max(200)).min(1).max(100) }).strict().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('business_selection_required');
    const pid = c.req.param('pid')!, did = c.req.param('did')!;
    await assignBusinessDomains(pid, did, parsed.data.businessIds);
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'domain.business.assign', targetKind: 'domain', targetId: did,
      meta: { businessIds: parsed.data.businessIds } });
    return c.json({ assigned: true });
  });
  r.post('/:did/business-domains/:bid', requireRole(['owner', 'planner']), async (c) => {
    const pid = c.req.param('pid')!, did = c.req.param('did')!, bid = c.req.param('bid')!;
    await assignBusinessDomain(pid, did, bid);
    // parent_id は書き換えず domain_memberships に積むだけなので、 監査も所属先として残す。
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'domain.business.assign',
      targetKind: 'domain', targetId: bid, meta: { coreId: did } });
    return c.json({ assigned: true });
  });
  r.put('/:did', requireRole(['owner', 'planner']), async (c) => {
    const pid = c.req.param('pid')!, did = c.req.param('did')!;
    const parsed = domainDefinitionSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('bad_domain_definition', parsed.error.flatten());
    const [before] = await getDb().select().from(domains).where(and(eq(domains.id, did), eq(domains.projectId, pid))).limit(1);
    if (!before) throw AppError.notFound('domain_not_found');
    if (before.definitionRevision !== parsed.data.expectedRevision) throw AppError.conflict('domain_definition_revision_conflict');
    // 露出先はプロジェクト内の生存 layouts に限る。 SQL 側でも同じ条件で弾くが、
    // ここで先に見ることで 「版不一致」 と 「参照先が無効」 を別のエラーとして返せる。
    if (parsed.data.sceneIds.length > 0) {
      const valid = await getDb().select({ id: layouts.id }).from(layouts)
        .where(and(eq(layouts.projectId, pid), isNull(layouts.deletedAt),
          inArray(layouts.id, parsed.data.sceneIds)));
      if (valid.length !== parsed.data.sceneIds.length) throw AppError.badRequest('scene_not_available');
    }
    if (parsed.data.anatomiaDomain) {
      if (!before.definitionKind && parsed.data.anatomiaDomain !== before.anatomiaDomain) {
        throw AppError.conflict('define_domain_before_anatomia_link');
      }
      const [project] = await getDb().select().from(projects).where(eq(projects.id, pid)).limit(1);
      if (!project?.anatomiaRepo) throw AppError.conflict('anatomia_repo_unset');
      const catalog = await fetchAnatomiaDomains(options, project.anatomiaRepo);
      if (!catalog.some((d) => d.name === parsed.data.anatomiaDomain)) throw AppError.badRequest('anatomia_domain_not_found');
    }
    await saveDomainDefinition(pid, did, parsed.data);
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'domain.definition.update',
      targetKind: 'domain', targetId: did, meta: { revision: parsed.data.expectedRevision + 1 } });
    return c.json({ revision: parsed.data.expectedRevision + 1 });
  });
  r.put('/:did/requirements/:sid', requireRole(['owner', 'planner']), async (c) => {
    const pid = c.req.param('pid')!, did = c.req.param('did')!, sid = c.req.param('sid')!;
    const body = await c.req.json().catch(() => null) as { linked?: unknown } | null;
    if (typeof body?.linked !== 'boolean') throw AppError.badRequest('linked_boolean_required');
    const [domain] = await getDb().select().from(domains).where(and(eq(domains.id, did), eq(domains.projectId, pid))).limit(1);
    const [spec] = await getDb().select({ id: specs.id }).from(specs)
      .where(and(eq(specs.id, sid), eq(specs.projectId, pid), isNull(specs.deletedAt))).limit(1);
    if (!domain || !spec) throw AppError.notFound('domain_or_requirement_not_found');
    if (!domain.definitionKind) throw AppError.conflict('define_domain_before_requirement_link');
    if (body.linked) await getDb().insert(specTargets).values({ specId: sid, kind: 'domain', refId: did }).onConflictDoNothing();
    else await getDb().delete(specTargets).where(and(eq(specTargets.specId, sid), eq(specTargets.kind, 'domain'), eq(specTargets.refId, did)));
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'domain.requirement.link',
      targetKind: 'domain', targetId: did, meta: { specId: sid, linked: body.linked } });
    return c.json({ linked: body.linked });
  });
  return r;
}
