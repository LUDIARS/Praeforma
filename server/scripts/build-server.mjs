// 常駐 server を事前コンパイルする (tsx を常駐させない、neco 2026-10-12 /
// AIFormat RULE_TECH_STACK.md「常駐プロセスの起動形」)。
//
//   node scripts/build-server.mjs            → server/dist/local.js
//
// ローカルモードの起動口 src/local.ts を 1 本に bundle する。local.ts が dynamic import する
// index.ts と、db/connection.ts が dynamic import する sqlite-schema.ts も同じ 1 ファイルに入る
// (splitting しないので dist/ 直下に 1 本だけ。ソース基準のパスは src/lib/runtime-paths.ts が
// この配置を前提に server/ を求める)。
//
// npm 依存は bundle せず node_modules から読む (packages: 'external')。better-sqlite3 のネイティブ
// addon や pg の任意依存をそのまま扱え、@ludiars/* (file: 依存) も JS で配布されている。

import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ENTRY = 'src/local.ts';
export const OUT_FILE = 'dist/local.js';

/** esbuild の設定 (serverDir = server パッケージのディレクトリ)。 */
export function serverBuildOptions(serverDir) {
  return {
    entryPoints: [resolve(serverDir, ENTRY)],
    outfile: resolve(serverDir, OUT_FILE),
    bundle: true,
    splitting: false,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    packages: 'external',
    sourcemap: true,
    logLevel: 'warning',
  };
}

export async function buildServer({ serverDir }) {
  rmSync(resolve(serverDir, 'dist'), { recursive: true, force: true });
  const options = serverBuildOptions(serverDir);
  await build(options);
  return options.outfile;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outfile = await buildServer({ serverDir });
  console.log(`[build-server] ${outfile}`);
}
