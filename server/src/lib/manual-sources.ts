import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { specs, specAcceptance } from '../db/schema/spec.ts';
import { specFragments } from '../db/schema/spec-fragment.ts';
import { AppError } from './errors.ts';
import { digest, loadManualSkill } from './manual-writer.ts';
import type { ManualSource } from '../../../shared/feature-manual.ts';

export async function readManualSpec(projectId: string, id: string): Promise<{ digest: string; material: unknown }> {
  if (id.startsWith('fragment:')) {
    const [fragment] = await getDb().select().from(specFragments).where(and(eq(specFragments.id,id.slice(9)),eq(specFragments.projectId,projectId))).limit(1);
    if (!fragment) throw AppError.notFound('manual_spec_not_found');
    const material = {content:fragment.content,revision:fragment.revision,implementationState:fragment.implementationState,
      implementationEvidence:fragment.implementationEvidence};
    return {material,digest:digest(JSON.stringify(material))};
  }
  const [spec] = await getDb().select().from(specs).where(and(eq(specs.id,id),eq(specs.projectId,projectId),isNull(specs.deletedAt))).limit(1);
  if (!spec) throw AppError.notFound('manual_spec_not_found');
  const acceptance = await getDb().select().from(specAcceptance).where(eq(specAcceptance.specId,id)).orderBy(specAcceptance.id);
  const material = { title: spec.title, description: spec.description, version: spec.version, status: spec.status,
    preconditions: spec.preconditions, postconditions: spec.postconditions,
    acceptance: acceptance.filter(a => a.enabled).map(a => ({ text:a.text, kind:a.kind })) };
  return { material, digest: digest(JSON.stringify(material)) };
}
export async function manualFreshness(projectId: string, source: ManualSource): Promise<'current' | 'outdated' | 'unavailable'> {
  try {
    const spec = await readManualSpec(projectId,source.specId);
    const skill = await loadManualSkill();
    return spec.digest === source.specDigest && skill.digest === source.skillDigest ? 'current' : 'outdated';
  } catch { return 'unavailable'; /* Missing or unreadable evidence must never appear current. */ }
}
