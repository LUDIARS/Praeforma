// 各ブランチの .praeforma/ に置く設計データの写し (spec/feature/branch-snapshot.md)。
// Pf は写しを生成して返すだけで、ブランチへは書かない。ブランチの写しは git から読むだけ。
import { basename } from 'node:path';
import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { requireAuth } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { defaultReposRoot, listRepoDirs, repoDirOf } from '../lib/project-git-activity.ts';
import { loadExportModel } from '../lib/export/load-model.ts';
import { readSpecHead } from '../lib/reconstruction-material.ts';
import { versionLabel } from '../../../shared/spec-versioning.ts';
import { buildSnapshotFiles, type SnapshotFile } from '../lib/branch-snapshot/snapshot-files.ts';
import { compareSnapshot } from '../lib/branch-snapshot/compare.ts';
import { listBranches, readSnapshotAt } from '../lib/branch-snapshot/snapshot-git.ts';

const VIEW_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const BIND_ROLES: readonly ProjectRole[] = ['owner'];
const bindingSchema = z.object({ repoDir: z.string().trim().min(1).max(255) }).strict();

type Project = typeof projects.$inferSelect;

async function loadProject(projectId: string): Promise<Project> {
  const [project] = await getDb().select().from(projects).where(and(eq(projects.id, projectId), isNull(projects.deletedAt))).limit(1);
  if (!project) throw AppError.notFound('project_not_found');
  return project;
}

// リポジトリ置き場の一覧にあるフォルダだけを対象にし、リクエストから任意のパスを指せないようにする。
function resolveRepoDir(project: Project): string {
  const dirs = listRepoDirs(defaultReposRoot());
  const bound = project.repoDataDir ? dirs.get(project.repoDataDir.toLowerCase()) : repoDirOf(project, dirs);
  if (!bound) throw AppError.conflict('repo_dir_not_found');
  return bound;
}

async function currentSnapshot(pid: string): Promise<SnapshotFile[]> {
  return buildSnapshotFiles(await loadExportModel(pid), versionLabel(await readSpecHead(pid)));
}

export function makeBranchSnapshotRouter(): Hono {
  const router = new Hono();
  router.use('*', requireAuth, requireRole(VIEW_ROLES));

  // 写しの一式。作業中のセッションが scripts/pf-snapshot.ts で取得してブランチへ書き出す。
  router.get('/', async (context) => {
    const pid = context.req.param('pid')!;
    await loadProject(pid);
    return context.json({ files: await currentSnapshot(pid) });
  });

  // ローカルブランチごとの写しと Pf の最新との比較 (新しい順に最大 50 件)。
  router.get('/branches', async (context) => {
    const pid = context.req.param('pid')!;
    const repoDir = resolveRepoDir(await loadProject(pid));
    const current = await currentSnapshot(pid);
    const branches = await listBranches(repoDir);
    const items = [];
    for (const branch of branches) {
      const comparison = compareSnapshot(current, await readSnapshotAt(repoDir, branch.commit));
      items.push({ ...branch, ...comparison });
    }
    return context.json({ repoDir: basename(repoDir), items });
  });

  router.put('/binding', requireRole(BIND_ROLES), async (context) => {
    const parsed = bindingSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_binding', parsed.error.flatten());
    const found = listRepoDirs(defaultReposRoot()).get(parsed.data.repoDir.toLowerCase());
    if (!found) throw AppError.badRequest('repo_dir_not_found');
    const projectId = context.req.param('pid')!;
    await loadProject(projectId);
    await getDb().update(projects).set({ repoDataDir: parsed.data.repoDir.toLowerCase(), updatedAt: new Date() }).where(eq(projects.id, projectId));
    return context.json({ repoDir: basename(found) });
  });

  return router;
}
