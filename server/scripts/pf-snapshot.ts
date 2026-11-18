// 設計データの写しを、いま作業しているブランチの .praeforma/ へ書き出す (spec/feature/branch-snapshot.md)。
//
//   node <Praeforma>/server/scripts/pf-snapshot.ts --project <pid> --url <Praeforma の URL> [--dir <作業ツリー>]
//
// 書き出すだけで commit はしない。コードと同じ変更単位で commit し、審査を通す。
// --url は Excubitor catalog の Praeforma (port-source-rule)。--dir の既定は現在のディレクトリ。
// Node の型除去だけで動くよう、読み込むのは依存の無い snapshot-manifest.ts のみ。
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { planSnapshotWrite, SNAPSHOT_DIR, SNAPSHOT_MANIFEST, type SnapshotFile } from '../src/lib/branch-snapshot/snapshot-manifest.ts';

interface Options { project: string; url: string; dir: string }

export function parseArgs(argv: readonly string[]): Options {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) throw new Error(`invalid argument: ${key ?? ''}`);
    values.set(key.slice(2), value);
  }
  const project = values.get('project') ?? '';
  const url = values.get('url') ?? '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(project)) throw new Error('--project <pid> is required');
  const parsed = URL.canParse(url) ? new URL(url) : null;
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.search || parsed.hash) throw new Error('--url <http(s) origin> is required');
  return { project, url: parsed.origin, dir: resolve(values.get('dir') ?? process.cwd()) };
}

function parseFiles(body: unknown): SnapshotFile[] {
  const files = (body as { files?: unknown } | null)?.files;
  if (!Array.isArray(files) || !files.every((f) => typeof f?.path === 'string' && typeof f?.content === 'string')) {
    throw new Error('unexpected response from Praeforma');
  }
  return files as SnapshotFile[];
}

/** 作業ツリーの外を指していないか、解決後のパスでも確かめる。 */
function inside(root: string, relative: string): string {
  const target = resolve(root, ...relative.split('/'));
  if (!target.startsWith(resolve(root, SNAPSHOT_DIR) + sep)) throw new Error(`refusing to touch ${relative}`);
  return target;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const response = await fetch(`${options.url}/api/projects/${encodeURIComponent(options.project)}/branch-snapshot`, {
    headers: { accept: 'application/json', ...(process.env.PRAEFORMA_TOKEN ? { authorization: `Bearer ${process.env.PRAEFORMA_TOKEN}` } : {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Praeforma responded ${response.status}`);
  const files = parseFiles(await response.json());
  const previous = await readFile(join(options.dir, ...SNAPSHOT_MANIFEST.split('/')), 'utf8').catch(() => null);
  const plan = planSnapshotWrite(files, previous);
  for (const path of plan.remove) await rm(inside(options.dir, path), { force: true });
  for (const file of plan.write) {
    const target = inside(options.dir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
  }
  process.stdout.write(`${JSON.stringify({ written: plan.write.map((f) => f.path), removed: plan.remove })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`pf-snapshot: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
