// Pf の最新 (DB) とブランチの写しを比べる (spec/feature/branch-snapshot.md)。純関数。
import { parseSnapshotManifest, SNAPSHOT_MANIFEST, type SnapshotFile } from './snapshot-manifest.ts';

export type SnapshotFileStatus = 'same' | 'changed' | 'missing_in_branch' | 'only_in_branch';
/** none: 写しが無い / invalid: manifest が読めない / same: 全一致 / differs: どこか違う */
export type SnapshotState = 'none' | 'invalid' | 'same' | 'differs';
export interface SnapshotComparison {
  state: SnapshotState;
  branchSpecVersion: string | null;
  files: Array<{ path: string; status: SnapshotFileStatus }>;
}

/** `branch` は写しディレクトリ配下のファイル内容 (無ければ空の Map)。 */
export function compareSnapshot(current: readonly SnapshotFile[], branch: ReadonlyMap<string, string>): SnapshotComparison {
  if (branch.size === 0) return { state: 'none', branchSpecVersion: null, files: [] };
  const manifest = parseSnapshotManifest(branch.get(SNAPSHOT_MANIFEST) ?? null);
  if (!manifest) return { state: 'invalid', branchSpecVersion: null, files: [] };
  const generated = new Set([SNAPSHOT_MANIFEST, ...manifest.files]);
  const files: SnapshotComparison['files'] = [];
  for (const file of current) {
    const theirs = branch.get(file.path);
    files.push({ path: file.path, status: theirs === undefined ? 'missing_in_branch' : theirs === file.content ? 'same' : 'changed' });
  }
  const ours = new Set(current.map((f) => f.path));
  // 人が置いたファイル (manifest に無い) は比較しない。
  for (const path of [...branch.keys()].sort()) {
    if (!ours.has(path) && generated.has(path)) files.push({ path, status: 'only_in_branch' });
  }
  return { state: files.every((f) => f.status === 'same') ? 'same' : 'differs', branchSpecVersion: manifest.specVersion, files };
}

