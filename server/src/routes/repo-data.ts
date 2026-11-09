/** Publishes a project's design data to the `pf-data` branch of its repository. */
import { basename } from 'node:path';
import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { recordAudit } from '../lib/audit.ts';
import { AppError } from '../lib/errors.ts';
import { defaultReposRoot, listRepoDirs, repoDirOf } from '../lib/project-git-activity.ts';
import { DATA_BRANCH, publishToDataBranch, pushDataBranch, readDataBranchFile, readDataBranchHead } from '../lib/repo-data/data-branch-git.ts';
import { importFragments, parseBranchFragments } from '../lib/repo-data/import-fragments.ts';
import { buildProjectDataFiles, FRAGMENTS_PATH } from '../lib/repo-data/project-data-files.ts';

const VIEW_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const PUBLISH_ROLES: readonly ProjectRole[] = ['owner', 'planner'];
const BIND_ROLES: readonly ProjectRole[] = ['owner'];
const bindingSchema = z.object({ repoDir: z.string().trim().min(1).max(255) }).strict();

type Project = typeof projects.$inferSelect;

async function loadProject(projectId: string): Promise<Project> {
  const [project] = await getDb().select().from(projects).where(and(eq(projects.id, projectId), isNull(projects.deletedAt))).limit(1);
  if (!project) throw AppError.notFound('project_not_found');
  return project;
}

// Only folders found by listing the repository root qualify, so a request can
// never name an arbitrary path.
function resolveRepoDir(project: Project): string {
  const dirs = listRepoDirs(defaultReposRoot());
  const bound = project.repoDataDir ? dirs.get(project.repoDataDir.toLowerCase()) : repoDirOf(project, dirs);
  if (!bound) throw AppError.conflict('repo_data_dir_not_found');
  return bound;
}

export function makeRepoDataRouter(): Hono {
  const router = new Hono();
  router.use('*', requireAuth, requireRole(VIEW_ROLES));

  router.get('/', async (context) => {
    const project = await loadProject(context.req.param('pid')!);
    const repoDir = resolveRepoDir(project);
    return context.json({ repoDir: basename(repoDir), branch: DATA_BRANCH, head: await readDataBranchHead(repoDir) });
  });

  router.put('/binding', requireRole(BIND_ROLES), async (context) => {
    const parsed = bindingSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_binding', parsed.error.flatten());
    const dirs = listRepoDirs(defaultReposRoot());
    const key = parsed.data.repoDir.toLowerCase();
    const found = dirs.get(key);
    if (!found) throw AppError.badRequest('repo_dir_not_found');
    const projectId = context.req.param('pid')!;
    await loadProject(projectId);
    await getDb().update(projects).set({ repoDataDir: key, updatedAt: new Date() }).where(eq(projects.id, projectId));
    return context.json({ repoDir: basename(found) });
  });

  router.post('/publish', requireRole(PUBLISH_ROLES), async (context) => {
    const projectId = context.req.param('pid')!;
    const project = await loadProject(projectId);
    const repoDir = resolveRepoDir(project);
    const files = await buildProjectDataFiles(project);
    const result = await publishToDataBranch(repoDir, files, `chore(pf-data): ${project.name} の設計データを更新`);
    await recordAudit({ projectId, actor: getIdentity(context), action: 'repo_data.publish',
      targetKind: 'project', targetId: projectId, meta: { commit: result.commit, changed: result.changed } });
    return context.json(result);
  });

  router.post('/push', requireRole(PUBLISH_ROLES), async (context) => {
    const projectId = context.req.param('pid')!;
    const commit = await pushDataBranch(resolveRepoDir(await loadProject(projectId)));
    await recordAudit({ projectId, actor: getIdentity(context), action: 'repo_data.push', targetKind: 'project', targetId: projectId, meta: { commit } });
    return context.json({ branch: DATA_BRANCH, commit });
  });

  router.post('/import', requireRole(PUBLISH_ROLES), async (context) => {
    const projectId = context.req.param('pid')!;
    const text = await readDataBranchFile(resolveRepoDir(await loadProject(projectId)), FRAGMENTS_PATH);
    if (text === null) throw AppError.conflict('data_branch_missing');
    const identity = getIdentity(context);
    const result = await importFragments(projectId, identity.userId, parseBranchFragments(text));
    await recordAudit({ projectId, actor: identity, action: 'repo_data.import', targetKind: 'project', targetId: projectId, meta: { ...result } });
    return context.json(result);
  });

  return router;
}
