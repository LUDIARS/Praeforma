import { versionRows } from '../db/spec-version-store.ts';

/** Only confirmed reconstruction consumes a fragment; implementation is a separate axis. */
export async function countPendingFragments(projectId: string): Promise<number> {
  const [row] = await versionRows(`SELECT COUNT(*) AS pending_count FROM spec_fragments f
    WHERE f.project_id = ? AND NOT EXISTS (
      SELECT 1 FROM spec_reconstruction_fragments r WHERE r.fragment_id = f.id
    )`, [projectId]);
  return Number(row?.pending_count ?? 0);
}
