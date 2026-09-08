import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { domains } from '../db/schema/domain.ts';
import { AppError } from './errors.ts';

/** 登録先プロジェクトに属するドメインだけを参照できる。 */
export async function requireProjectDomains(pid: string, ids: readonly string[]): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) throw AppError.badRequest('domain_required');
  const rows = await getDb().select({ id: domains.id }).from(domains)
    .where(and(eq(domains.projectId, pid), inArray(domains.id, uniqueIds)));
  if (rows.length !== uniqueIds.length) throw AppError.badRequest('domain_not_available');
}
