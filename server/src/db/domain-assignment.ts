import { versionBatch, versionRows } from './spec-version-store.ts';
import { AppError } from '../lib/errors.ts';
import { domainRelations, reaches, type RelationDomain, type DomainMembership } from '../../../shared/domain-relations.ts';

export async function readMemberships(projectId: string): Promise<DomainMembership[]> {
  const rows = await versionRows(`SELECT m.core_id,m.business_id FROM domain_memberships m
    JOIN domains c ON c.id=m.core_id AND c.project_id=m.project_id
    JOIN domains b ON b.id=m.business_id AND b.project_id=m.project_id
    WHERE m.project_id=? AND c.definition_kind='core' AND b.definition_kind='business'`, [projectId]);
  return rows.map(row => ({ coreId: String(row.core_id), businessId: String(row.business_id) }));
}

/** Validate the whole selection under a project lock; additive writes preserve other memberships. */
export async function assignBusinessDomains(projectId: string, coreId: string, businessIds: string[]): Promise<void> {
  const ids = [...new Set(businessIds)];
  if (!ids.length || ids.length > 100) throw AppError.badRequest('business_selection_required');
  let domains: RelationDomain[] = [];
  await versionBatch([
    { sql: 'SELECT id FROM projects WHERE id=? AND deleted_at IS NULL', args: [projectId], lock: true,
      check: rows => { if (!rows.length) throw AppError.notFound('project_not_found'); return true; } },
    { sql: 'SELECT id,parent_id,definition_kind FROM domains WHERE project_id=? ORDER BY id', args: [projectId], lock: true,
      check: rows => {
        domains = rows.map(row => ({ id: String(row.id), parentId: row.parent_id === null ? null : String(row.parent_id),
          definitionKind: row.definition_kind as RelationDomain['definitionKind'] }));
        if (!domains.some(domain => domain.id === coreId && domain.definitionKind === 'core')
          || ids.some(id => !domains.some(domain => domain.id === id && domain.definitionKind === 'business'))) {
          throw AppError.conflict('business_domain_not_available');
        }
        return true;
      } },
    { sql: 'SELECT core_id,business_id FROM domain_memberships WHERE project_id=?', args: [projectId], lock: true,
      check: rows => {
        // 追加しようとしている辺どうしも循環を作りうるので、 既存 + 今回分をまとめて判定する。
        const stored = rows.map(row => ({ coreId: String(row.core_id), businessId: String(row.business_id) }));
        const relations = domainRelations(domains, [...stored, ...ids.map(businessId => ({ coreId, businessId }))]);
        if (ids.some(id => reaches(relations, id, coreId))) throw AppError.conflict('domain_relation_cycle');
        return true;
      } },
    ...ids.map(id => ({ sql: 'INSERT INTO domain_memberships(project_id,core_id,business_id) VALUES(?,?,?) ON CONFLICT(project_id,core_id,business_id) DO NOTHING', args: [projectId, coreId, id] })),
  ]);
}
export async function assignBusinessDomain(projectId: string, coreId: string, businessId: string): Promise<void> {
  await assignBusinessDomains(projectId, coreId, [businessId]);
}
