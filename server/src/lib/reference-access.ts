import { and, eq, type SQL } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { references, type ReferenceTargetKind } from '../db/schema/reference.ts';
import { type ProjectRole } from '../db/schema/project.ts';
import { versionRows } from '../db/spec-version-store.ts';
import { AppError } from './errors.ts';
import { contract } from '@ludiars/log-weaver'; /* augur-inject:import:84545c8a */
import augurContract_78776b40 from '../../contracts/reference-project.contract.ts'; /* augur-inject:contract-predicate:3291f551 */

export const REFERENCE_READ_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
export const REFERENCE_WRITE_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

export function referenceBelongsToProject(reference: { projectId: string } | undefined, projectId: string): boolean {
  return reference !== undefined && reference.projectId === projectId;
}
// @ts-expect-error augur-inject
referenceBelongsToProject = contract(referenceBelongsToProject, { ...augurContract_78776b40, contractId: 'C-6', mode: 'observe', sample: 1, where: 'server/src/lib/reference-access.ts:11', rule: 'contract-wrap', id: '78776b40' }); /* augur-inject:contract-wrap:78776b40 */

/** Use this condition for reads AND mutations; no rid-only lookup may precede authorization. */
export function referenceScope(projectId: string, referenceId: string): SQL | undefined {
  return and(eq(references.projectId, projectId), eq(references.id, referenceId));
}

export async function requireProjectReference(projectId: string, referenceId: string): Promise<typeof references.$inferSelect> {
  const [reference] = await getDb().select().from(references).where(referenceScope(projectId, referenceId)).limit(1);
  if (!reference || !referenceBelongsToProject(reference, projectId)) throw AppError.notFound();
  return reference;
}

export async function requireReferenceTarget(projectId: string, kind: ReferenceTargetKind, targetId: string): Promise<void> {
  // Identifiers come from this fixed table, never from request text.
  const targets = { project: 'projects', domain: 'domains', object: 'objects', spec: 'specs' } as const;
  const table = targets[kind];
  const scope = kind === 'project' ? 'id' : 'project_id';
  const active = kind === 'domain' ? '' : ' AND deleted_at IS NULL';
  const rows = await versionRows(`SELECT id FROM ${table} WHERE id=? AND ${scope}=?${active}`, [targetId, projectId]);
  if (!rows.length) throw AppError.notFound('reference_target_not_found');
}
