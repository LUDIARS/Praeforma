// DB → ExportModel の読み取り (feature/screen-flow.md §7)。 生成器は DB を知らない。
//
// @spec 7. 生成物の形式

import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../../db/connection.ts';
import { projects } from '../../db/schema/project.ts';
import { domains } from '../../db/schema/domain.ts';
import { objects, objectAttrs } from '../../db/schema/object.ts';
import { layouts, layoutObjects } from '../../db/schema/layout.ts';
import { specs, specTargets, specAcceptance } from '../../db/schema/spec.ts';
import { transitions, ccLinks } from '../../db/schema/screen-flow.ts';
import { AppError } from '../errors.ts';
import type {
  ExportDomain,
  ExportModel,
  ExportRequirement,
  ExportScreen,
  ExportWidget,
} from './model.ts';

function attrString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

/** 対象 (kind, refId) → 要件一覧 を一括で引く。 */
async function loadRequirementsByTarget(pid: string): Promise<Map<string, ExportRequirement[]>> {
  const db = getDb();
  const specRows = await db
    .select()
    .from(specs)
    .where(and(eq(specs.projectId, pid), isNull(specs.deletedAt)))
    .orderBy(asc(specs.code));
  const byTarget = new Map<string, ExportRequirement[]>();
  if (specRows.length === 0) return byTarget;
  const ids = specRows.map((s) => s.id);
  const [targets, acc] = await Promise.all([
    db.select().from(specTargets).where(inArray(specTargets.specId, ids)),
    db
      .select()
      .from(specAcceptance)
      .where(and(inArray(specAcceptance.specId, ids), eq(specAcceptance.enabled, true)))
      .orderBy(asc(specAcceptance.ordinal)),
  ]);
  const accBySpec = new Map<string, string[]>();
  for (const a of acc) {
    const arr = accBySpec.get(a.specId) ?? [];
    arr.push(a.text);
    accBySpec.set(a.specId, arr);
  }
  const reqById = new Map(
    specRows.map((s) => [
      s.id,
      {
        code: s.code,
        title: s.title,
        description: s.description,
        priority: s.priority,
        category: s.category,
        acceptance: accBySpec.get(s.id) ?? [],
      } satisfies ExportRequirement,
    ]),
  );
  for (const t of targets) {
    const req = reqById.get(t.specId);
    if (!req) continue;
    const key = `${t.kind}:${t.refId}`;
    const arr = byTarget.get(key) ?? [];
    arr.push(req);
    byTarget.set(key, arr);
  }
  return byTarget;
}

export async function loadExportModel(pid: string): Promise<ExportModel> {
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, pid)).limit(1);
  if (!project) throw AppError.notFound('project_not_found');

  const [domainRows, layoutRows, objectRows, transitionRows, ccRows, reqByTarget] =
    await Promise.all([
      db.select().from(domains).where(eq(domains.projectId, pid)).orderBy(asc(domains.name)),
      db
        .select()
        .from(layouts)
        .where(and(eq(layouts.projectId, pid), isNull(layouts.deletedAt)))
        .orderBy(asc(layouts.name)),
      db
        .select()
        .from(objects)
        .where(and(eq(objects.projectId, pid), isNull(objects.deletedAt))),
      db
        .select()
        .from(transitions)
        .where(eq(transitions.projectId, pid))
        .orderBy(asc(transitions.ordinal)),
      db.select().from(ccLinks).where(eq(ccLinks.projectId, pid)),
      loadRequirementsByTarget(pid),
    ]);

  const domainById = new Map(domainRows.map((d) => [d.id, d]));
  const objectById = new Map(objectRows.map((o) => [o.id, o]));
  const objectIds = objectRows.map((o) => o.id);
  const attrRows =
    objectIds.length > 0
      ? await db.select().from(objectAttrs).where(inArray(objectAttrs.objectId, objectIds))
      : [];
  const attrsByObject = new Map<string, Record<string, unknown>>();
  for (const a of attrRows) {
    const rec = attrsByObject.get(a.objectId) ?? {};
    rec[a.key] = a.value;
    attrsByObject.set(a.objectId, rec);
  }
  const layoutIds = layoutRows.map((l) => l.id);
  const placements =
    layoutIds.length > 0
      ? await db
          .select()
          .from(layoutObjects)
          .where(inArray(layoutObjects.layoutId, layoutIds))
          .orderBy(asc(layoutObjects.ordinal))
      : [];

  const screens: ExportScreen[] = layoutRows.map((l) => {
    const widgets: ExportWidget[] = [];
    const domainVotes = new Map<string, number>();
    for (const p of placements.filter((p) => p.layoutId === l.id)) {
      const o = objectById.get(p.objectId);
      if (!o) continue;
      const attrs = attrsByObject.get(o.id) ?? {};
      const d = domainById.get(o.domainId);
      if (d) domainVotes.set(d.id, (domainVotes.get(d.id) ?? 0) + 1);
      widgets.push({
        placementId: p.id,
        objectId: o.id,
        name: o.label,
        widget: attrString(attrs.widget),
        label: attrString(attrs.label),
        action: attrString(attrs.action),
        domainName: d?.name ?? null,
      });
    }
    const topDomainId = [...domainVotes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    const topDomain = topDomainId ? domainById.get(topDomainId) : undefined;
    return {
      id: l.id,
      name: l.name,
      description: l.description,
      kind: l.kind,
      domainName: topDomain?.name ?? null,
      anatomiaDomain: topDomain?.anatomiaDomain ?? null,
      widgets,
      requirements: reqByTarget.get(`layout:${l.id}`) ?? [],
    };
  });

  const exportDomains: ExportDomain[] = domainRows.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    anatomiaDomain: d.anatomiaDomain,
    requirements: reqByTarget.get(`domain:${d.id}`) ?? [],
  }));

  return {
    projectName: project.name,
    anatomiaRepo: project.anatomiaRepo ?? null,
    screens,
    transitions: transitionRows.map((t) => ({
      id: t.id,
      fromLayoutId: t.fromLayoutId,
      toLayoutId: t.toLayoutId,
      sourcePlacementId: t.sourceObjectId,
      trigger: t.trigger,
      condition: t.condition,
      label: t.label,
      ordinal: t.ordinal,
    })),
    domains: exportDomains,
    ccLinks: ccRows.map((c) => ({
      targetKind: c.targetKind,
      targetId: c.targetId,
      ccKind: c.ccKind,
      ccId: c.ccId,
      status: c.status,
    })),
  };
}
