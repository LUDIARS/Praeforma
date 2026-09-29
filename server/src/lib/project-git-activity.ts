// プロジェクトごとの最後の git 更新時刻 (トップの一覧を「最近 git 更新があった順」に並べるため)。
// 2026-09-29 neco 指示。Pf のプロジェクトは Concordia のプロジェクト登録から作られ、名前 (または anatomiaRepo) が
// リポジトリのディレクトリ名と一致する。リポジトリの置き場所 (root) の直下だけを見る。
// ディレクトリ名は root を読んだ一覧から照合するので、プロジェクト名から任意のパスは作らない。
import { existsSync, readdirSync } from 'node:fs';
import { open, readFile, stat, type FileHandle } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface GitActivityProject { id: string; name: string; anatomiaRepo?: string | null }

/** リポジトリの最後の git 更新時刻 (ISO)。読めなければ null。 */
export type LastCommitReader = (repoDir: string) => Promise<string | null>;

/** reflog の末尾だけを読む (長く使ったリポジトリでも読み取り量を抑える)。 */
const REFLOG_TAIL_BYTES = 64 * 1024;
const REFLOG_LINE = /\s(\d{9,})\s[+-]\d{4}\t(.*)$/;

/**
 * reflog の行から、コミット・マージ・pull などで HEAD が進んだ最後の時刻を取る。
 * ブランチの切り替え (checkout) は作業の中身が変わっていないので数えない。
 */
export function lastUpdateFromReflog(text: string): string | null {
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = REFLOG_LINE.exec(lines[i]!);
    if (!match || match[2]!.startsWith('checkout:')) continue;
    return new Date(Number(match[1]) * 1000).toISOString();
  }
  return null;
}

/** .git がファイル (worktree / submodule) なら、その gitdir を指す。 */
async function gitDirOf(repoDir: string): Promise<string> {
  const dotGit = join(repoDir, '.git');
  if ((await stat(dotGit)).isDirectory()) return dotGit;
  const pointer = /^gitdir:\s*(.+)$/m.exec(await readFile(dotGit, 'utf8'));
  return pointer ? resolve(repoDir, pointer[1]!.trim()) : dotGit;
}

/**
 * git を起動せず、HEAD の reflog から読む。全リポジトリで `git log` を走らせると
 * 手元の 90 リポジトリで 45 秒かかったため (2026-09-29 実測)。
 */
export const readLastCommitAt: LastCommitReader = async (repoDir) => {
  let handle: FileHandle | null = null;
  try {
    handle = await open(join(await gitDirOf(repoDir), 'logs', 'HEAD'), 'r');
    const { size } = await handle.stat();
    const length = Math.min(size, REFLOG_TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    return lastUpdateFromReflog(buffer.toString('utf8'));
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
};

/** root 直下の git リポジトリを、小文字にした名前で引ける形にする。 */
export function listRepoDirs(root: string): Map<string, string> {
  const dirs = new Map<string, string>();
  let entries: string[];
  try { entries = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); }
  catch { return dirs; }
  for (const name of entries) {
    const dir = join(root, name);
    if (existsSync(join(dir, '.git'))) dirs.set(name.toLowerCase(), dir);
  }
  return dirs;
}

/** プロジェクト名、なければ anatomiaRepo で照合する。 */
export function repoDirOf(project: GitActivityProject, dirs: Map<string, string>): string | null {
  for (const key of [project.name, project.anatomiaRepo]) {
    const dir = key ? dirs.get(key.trim().toLowerCase()) : undefined;
    if (dir) return dir;
  }
  return null;
}

/** 設定 PRAEFORMA_GIT_REPOS_ROOT、なければ Pf リポジトリの親 (LUDIARS のリポジトリが並ぶ場所)。 */
export function defaultReposRoot(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PRAEFORMA_GIT_REPOS_ROOT?.trim();
  return configured ? resolve(configured) : resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
}

const CONCURRENCY = 8;

async function readAll(dirs: string[], reader: LastCommitReader): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < dirs.length) {
      const dir = dirs[next++]!;
      out.set(dir, await reader(dir));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, dirs.length) }, worker));
  return out;
}

/**
 * 最新コミット時刻を TTL の間だけ覚えておく。一覧を開くたびに全リポジトリで git を走らせない。
 * 同時の問い合わせは 1 回の読み取りにまとめる。
 */
export class ProjectGitActivity {
  private cache: { at: number; byDir: Map<string, string | null>; dirs: Map<string, string> } | null = null;
  private pending: Promise<void> | null = null;

  constructor(
    private readonly root: string,
    private readonly reader: LastCommitReader = readLastCommitAt,
    private readonly ttlMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** プロジェクト id → 最新コミット時刻 (リポジトリが無い・読めないプロジェクトは null)。 */
  async lookup(projects: readonly GitActivityProject[]): Promise<Map<string, string | null>> {
    if (!this.cache || this.now() - this.cache.at >= this.ttlMs) {
      this.pending ??= this.refresh().finally(() => { this.pending = null; });
      await this.pending;
    }
    const { byDir, dirs } = this.cache!;
    return new Map(projects.map((p) => {
      const dir = repoDirOf(p, dirs);
      return [p.id, dir ? byDir.get(dir) ?? null : null];
    }));
  }

  private async refresh(): Promise<void> {
    const dirs = listRepoDirs(this.root);
    const byDir = await readAll([...dirs.values()], this.reader);
    this.cache = { at: this.now(), byDir, dirs };
  }
}
