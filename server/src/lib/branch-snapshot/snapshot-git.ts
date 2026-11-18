// ブランチの写しを git から読む (読み取りのみ。作業ツリー・チェックアウト・ref は変えない)。
import { execFile } from 'node:child_process';
import { AppError } from '../errors.ts';
import { SNAPSHOT_DIR } from './snapshot-manifest.ts';

const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
export const MAX_BRANCHES = 50;
const MAX_SNAPSHOT_FILES = 64;

function git(repoDir: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', ['-C', repoDir, ...args], {
      encoding: 'utf8', windowsHide: true, timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_OUTPUT_BYTES,
    }, (error, stdout) => resolve(error ? null : stdout));
  });
}

export interface BranchHead { name: string; commit: string; updatedAt: string }

/** `for-each-ref` の出力を読む (純関数)。 */
export function parseBranchList(out: string): BranchHead[] {
  return out.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name = '', commit = '', updatedAt = ''] = line.split('\t');
    return { name, commit, updatedAt };
  }).filter((b) => b.name && /^[0-9a-f]{40,64}$/.test(b.commit));
}

/** ローカルブランチを新しい順に最大 MAX_BRANCHES 件。 */
export async function listBranches(repoDir: string): Promise<BranchHead[]> {
  const out = await git(repoDir, ['for-each-ref', '--sort=-committerdate', `--count=${MAX_BRANCHES}`,
    '--format=%(refname:short)%09%(objectname)%09%(committerdate:iso-strict)', 'refs/heads']);
  if (out === null) throw AppError.internal('git_failed:for-each-ref');
  return parseBranchList(out);
}

/** コミット時点の写しディレクトリ配下のファイル。写しが無ければ空の Map。 */
export async function readSnapshotAt(repoDir: string, commit: string): Promise<Map<string, string>> {
  if (!/^[0-9a-f]{40,64}$/.test(commit)) throw AppError.badRequest('invalid_commit');
  const listed = await git(repoDir, ['ls-tree', '-r', '--name-only', commit, '--', `${SNAPSHOT_DIR}/`]);
  if (listed === null) throw AppError.internal('git_failed:ls-tree');
  const paths = listed.split('\n').filter(Boolean).slice(0, MAX_SNAPSHOT_FILES);
  const files = new Map<string, string>();
  for (const path of paths) {
    const content = await git(repoDir, ['show', `${commit}:${path}`]);
    if (content !== null) files.set(path, content);
  }
  return files;
}
