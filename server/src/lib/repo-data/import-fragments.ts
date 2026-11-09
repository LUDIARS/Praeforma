/** Adds fragments found on a data branch to a project. Existing fragments are never changed. */
import { and, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb } from '../../db/connection.ts';
import { specFragments } from '../../db/schema/spec-fragment.ts';
import { AppError } from '../errors.ts';

const branchFragmentSchema = z.object({
  content: z.string().min(1).max(20000),
  source: z.string().min(1).max(64),
  sourceEventId: z.string().uuid(),
});
const branchFragmentsSchema = z.array(branchFragmentSchema);

export type BranchFragment = z.infer<typeof branchFragmentSchema>;
export interface FragmentImportResult { imported: number; existing: number; conflicts: number }

export function parseBranchFragments(text: string): BranchFragment[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw AppError.badRequest('invalid_branch_fragments');
  }
  const parsed = branchFragmentsSchema.safeParse(value);
  if (!parsed.success) throw AppError.badRequest('invalid_branch_fragments', parsed.error.flatten());
  return parsed.data;
}

export async function importFragments(projectId: string, actorId: string, fragments: readonly BranchFragment[]): Promise<FragmentImportResult> {
  const result: FragmentImportResult = { imported: 0, existing: 0, conflicts: 0 };
  for (const fragment of fragments) {
    const inserted = await getDb().insert(specFragments).values({ id: ulid(), projectId, content: fragment.content,
      source: fragment.source, sourceEventId: fragment.sourceEventId, createdBy: actorId }).onConflictDoNothing({
      target: [specFragments.projectId, specFragments.source, specFragments.sourceEventId],
    }).returning({ id: specFragments.id });
    if (inserted[0]) {
      result.imported += 1;
      continue;
    }
    const [current] = await getDb().select({ content: specFragments.content }).from(specFragments).where(and(
      eq(specFragments.projectId, projectId), eq(specFragments.source, fragment.source), eq(specFragments.sourceEventId, fragment.sourceEventId),
    )).limit(1);
    if (current?.content === fragment.content) result.existing += 1;
    else result.conflicts += 1;
  }
  return result;
}
