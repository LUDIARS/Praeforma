/** PF-SPRINT persistence. Counts and stages are derived from fragments on every read. */
import { inArray } from 'drizzle-orm';
import { ulid } from 'ulid';
import { getDb } from '../db/connection.ts';
import { specFragments } from '../db/schema/spec-fragment.ts';
import { versionRows, versionBatch, type VersionStatement } from '../db/spec-version-store.ts';
import { AppError } from './errors.ts';
import { sprintStage, type SpecSprint, type SprintCounts, type SprintFragment } from '../../../shared/spec-sprints.ts';

const SPRINT_LIST_LIMIT = 100;
const UNASSIGNED_LIMIT = 200;

const SPRINT_SUMMARY_SQL = `SELECT s.id,s.project_id,s.title,s.goal,s.created_by,s.created_at,
  COUNT(f.id) AS total,
  SUM(CASE WHEN f.implementation_state='implemented' THEN 1 ELSE 0 END) AS implemented,
  SUM(CASE WHEN f.implementation_state='unimplemented' THEN 1 ELSE 0 END) AS unimplemented,
  SUM(CASE WHEN f.implementation_state='unverified' THEN 1 ELSE 0 END) AS unverified,
  SUM(CASE WHEN r.fragment_id IS NOT NULL THEN 1 ELSE 0 END) AS reconstructed,
  SUM(CASE WHEN f.id IS NOT NULL AND r.fragment_id IS NULL AND f.implementation_state<>'implemented' THEN 1 ELSE 0 END) AS pending_not_implemented
  FROM spec_sprints s
  LEFT JOIN spec_sprint_fragments sf ON sf.sprint_id=s.id
  LEFT JOIN spec_fragments f ON f.id=sf.fragment_id
  LEFT JOIN spec_reconstruction_fragments r ON r.fragment_id=f.id`;

function toSprint(row: Record<string, unknown>): SpecSprint {
  const counts: SprintCounts = {
    total: Number(row.total ?? 0), implemented: Number(row.implemented ?? 0), unimplemented: Number(row.unimplemented ?? 0),
    unverified: Number(row.unverified ?? 0), reconstructed: Number(row.reconstructed ?? 0),
    pendingNotImplemented: Number(row.pending_not_implemented ?? 0),
  };
  return { id: String(row.id), projectId: String(row.project_id), title: String(row.title), goal: String(row.goal),
    createdBy: String(row.created_by), createdAt: String(row.created_at), counts, stage: sprintStage(counts) };
}

export async function listSprints(pid: string): Promise<SpecSprint[]> {
  const rows = await versionRows(`${SPRINT_SUMMARY_SQL} WHERE s.project_id=? GROUP BY s.id,s.project_id,s.title,s.goal,s.created_by,s.created_at ORDER BY s.created_at DESC, s.id DESC LIMIT ${SPRINT_LIST_LIMIT}`, [pid]);
  return rows.map(toSprint);
}

export async function readSprint(pid: string, sid: string): Promise<SpecSprint> {
  const [row] = await versionRows(`${SPRINT_SUMMARY_SQL} WHERE s.project_id=? AND s.id=? GROUP BY s.id,s.project_id,s.title,s.goal,s.created_by,s.created_at`, [pid, sid]);
  if (!row) throw AppError.notFound('sprint_not_found');
  return toSprint(row);
}

async function fragmentsByIds(ids: string[]): Promise<Map<string, typeof specFragments.$inferSelect>> {
  if (!ids.length) return new Map();
  const rows = await getDb().select().from(specFragments).where(inArray(specFragments.id, ids));
  return new Map(rows.map((row) => [row.id, row]));
}

export async function sprintFragments(pid: string, sid: string): Promise<SprintFragment[]> {
  const links = await versionRows(`SELECT sf.fragment_id, CASE WHEN r.fragment_id IS NULL THEN 0 ELSE 1 END AS reconstructed
    FROM spec_sprint_fragments sf JOIN spec_fragments f ON f.id=sf.fragment_id AND f.project_id=?
    LEFT JOIN spec_reconstruction_fragments r ON r.fragment_id=sf.fragment_id
    WHERE sf.sprint_id=? ORDER BY sf.fragment_id DESC`, [pid, sid]);
  const rows = await fragmentsByIds(links.map((link) => String(link.fragment_id)));
  return links.flatMap((link) => {
    const row = rows.get(String(link.fragment_id));
    return row ? [{ ...row, reconstructed: Number(link.reconstructed) === 1 } as unknown as SprintFragment] : [];
  });
}

/** PF-SPRINT-8: structured fragments are excluded because they are no longer pending. */
export async function unassignedFragments(pid: string): Promise<SprintFragment[]> {
  const links = await versionRows(`SELECT f.id FROM spec_fragments f WHERE f.project_id=?
    AND NOT EXISTS(SELECT 1 FROM spec_sprint_fragments sf WHERE sf.fragment_id=f.id)
    AND NOT EXISTS(SELECT 1 FROM spec_reconstruction_fragments r WHERE r.fragment_id=f.id)
    ORDER BY f.id DESC LIMIT ${UNASSIGNED_LIMIT}`, [pid]);
  const rows = await fragmentsByIds(links.map((link) => String(link.id)));
  return links.flatMap((link) => {
    const row = rows.get(String(link.id));
    return row ? [{ ...row, reconstructed: false } as unknown as SprintFragment] : [];
  });
}

/** PF-SPRINT-2: returns the ids that still need a link; ids already in this sprint are idempotent. */
async function fragmentsToLink(pid: string, sid: string | null, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const rows = await versionRows(`SELECT f.id, sf.sprint_id FROM spec_fragments f
    LEFT JOIN spec_sprint_fragments sf ON sf.fragment_id=f.id
    WHERE f.project_id=? AND f.id IN (${unique.map(() => '?').join(',')})`, [pid, ...unique]);
  if (rows.length !== unique.length) throw AppError.notFound('fragment_not_found');
  if (rows.some((row) => row.sprint_id !== null && row.sprint_id !== sid)) throw AppError.conflict('fragment_in_other_sprint');
  return rows.filter((row) => row.sprint_id === null).map((row) => String(row.id));
}

function linkSteps(pid: string, sid: string, ids: string[], actor: string, at: string): VersionStatement[] {
  return ids.map((id) => ({
    sql: `INSERT INTO spec_sprint_fragments(fragment_id,sprint_id,added_by,added_at)
      SELECT f.id,?,?,? FROM spec_fragments f WHERE f.id=? AND f.project_id=?
      AND NOT EXISTS(SELECT 1 FROM spec_sprint_fragments x WHERE x.fragment_id=f.id)`,
    args: [sid, actor, at, id, pid], affected: 1,
  }));
}

export async function createSprint(pid: string, input: { title: string; goal?: string; fragmentIds?: string[] }, actor: string): Promise<SpecSprint> {
  const ids = await fragmentsToLink(pid, null, input.fragmentIds ?? []);
  const id = ulid();
  const at = new Date().toISOString();
  await versionBatch([
    { sql: 'INSERT INTO spec_sprints(id,project_id,title,goal,created_by,created_at) VALUES(?,?,?,?,?,?)',
      args: [id, pid, input.title, input.goal ?? '', actor, at], affected: 1 },
    ...linkSteps(pid, id, ids, actor, at),
  ]);
  return readSprint(pid, id);
}

export async function addSprintFragments(pid: string, sid: string, fragmentIds: string[], actor: string): Promise<SpecSprint> {
  await readSprint(pid, sid);
  const ids = await fragmentsToLink(pid, sid, fragmentIds);
  if (ids.length) await versionBatch(linkSteps(pid, sid, ids, actor, new Date().toISOString()));
  return readSprint(pid, sid);
}

/** PF-SPRINT-3: structured fragments keep their sprint as provenance. */
export async function removeSprintFragment(pid: string, sid: string, fid: string): Promise<SpecSprint> {
  await readSprint(pid, sid);
  const [link] = await versionRows(`SELECT r.fragment_id AS reconstructed FROM spec_sprint_fragments sf
    LEFT JOIN spec_reconstruction_fragments r ON r.fragment_id=sf.fragment_id
    WHERE sf.sprint_id=? AND sf.fragment_id=?`, [sid, fid]);
  if (!link) throw AppError.notFound('fragment_not_in_sprint');
  if (link.reconstructed !== null) throw AppError.conflict('fragment_already_structured');
  await versionBatch([{ sql: `DELETE FROM spec_sprint_fragments WHERE sprint_id=? AND fragment_id=?
    AND NOT EXISTS(SELECT 1 FROM spec_reconstruction_fragments r WHERE r.fragment_id=?)`, args: [sid, fid, fid], affected: 1 }]);
  return readSprint(pid, sid);
}
