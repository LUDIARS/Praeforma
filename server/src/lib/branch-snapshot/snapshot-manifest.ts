// 写しの置き場所と manifest の形 (spec/feature/branch-snapshot.md)。
// 書き出し CLI (server/scripts/pf-snapshot.ts) からも読むので、他のモジュールに依存しない。

export const SNAPSHOT_DIR = '.praeforma';
export const SNAPSHOT_MANIFEST = `${SNAPSHOT_DIR}/manifest.json`;
export const SNAPSHOT_FORMAT = 1;

export interface SnapshotFile { path: string; content: string }
export interface SnapshotManifest { format: number; project: string; specVersion: string; files: string[] }

/** manifest を読む。読めなければ null。 */
export function parseSnapshotManifest(text: string | null): SnapshotManifest | null {
  if (text === null) return null;
  try {
    const value = JSON.parse(text) as Partial<SnapshotManifest>;
    if (typeof value.format !== 'number' || typeof value.project !== 'string' || typeof value.specVersion !== 'string'
      || !Array.isArray(value.files) || !value.files.every((f) => typeof f === 'string')) return null;
    return { format: value.format, project: value.project, specVersion: value.specVersion, files: value.files };
  } catch {
    return null;
  }
}

/** 写しの中だけを指す相対パスか (書き出しで外へ出ないための検査)。 */
export function isSnapshotPath(path: string): boolean {
  if (!path.startsWith(`${SNAPSHOT_DIR}/`) || path.includes('\\') || path.includes('\0') || path.includes(':')) return false;
  return path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

/** 書き出し先に適用する操作。前回の manifest に載っていて今回生成しないファイルだけ消す (人が置いたファイルは残す)。 */
export function planSnapshotWrite(current: readonly SnapshotFile[], previousManifestText: string | null): { write: SnapshotFile[]; remove: string[] } {
  for (const file of current) if (!isSnapshotPath(file.path)) throw new Error(`snapshot path outside ${SNAPSHOT_DIR}: ${file.path}`);
  const previous = parseSnapshotManifest(previousManifestText);
  const next = new Set(current.map((f) => f.path));
  const remove = previous ? previous.files.filter((path) => !next.has(path) && path !== SNAPSHOT_MANIFEST && isSnapshotPath(path)) : [];
  return { write: [...current], remove };
}
