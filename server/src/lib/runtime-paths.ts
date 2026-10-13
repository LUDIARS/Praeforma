// ソース基準のパス解決 (ソースを tsx で読む経路と、事前コンパイルした dist を node で起動する経路で共有)。
//
// 常駐の server は esbuild で `server/dist/local.js` 1 本へ bundle して起動する
// (tsx を常駐させない、neco 2026-10-12 / AIFormat RULE_TECH_STACK.md「常駐プロセスの起動形」)。
// bundle 後は各モジュールの `import.meta.url` が `server/dist/local.js` を指すため、
// モジュール位置からの相対 (`new URL('../../../x', import.meta.url)`) はソースと食い違う。
// リポジトリ内のファイル (skills/、web/dist/ など) は必ずここで求めた基点から組み立てる。

import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contract } from '@ludiars/log-weaver'; /* augur-inject:import:59f9fda8 */
import augurContract_acc6f1cf from '../../contracts/server-dir.contract.ts'; /* augur-inject:contract-predicate:fff52488 */

export const BUILD_DIR = 'dist';

/**
 * server パッケージのディレクトリ (`<repo>/server`)。
 * `moduleUrl` はこのファイル自身の URL を想定する: ソースなら `server/src/lib/runtime-paths.ts`、
 * bundle 後なら `server/dist/<entry>.js`。
 */
export function serverDirOf(moduleUrl: string): string {
  const here = dirname(fileURLToPath(moduleUrl));
  const compiled = moduleUrl.endsWith('.js') && basename(here) === BUILD_DIR;
  return compiled ? resolve(here, '..') : resolve(here, '..', '..');
}
// @ts-expect-error augur-inject
serverDirOf = contract(serverDirOf, { ...augurContract_acc6f1cf, contractId: 'C-8', mode: 'observe', sample: 1, where: 'server/src/lib/runtime-paths.ts:19', rule: 'contract-wrap', id: 'acc6f1cf' }); /* augur-inject:contract-wrap:acc6f1cf */

/** server パッケージのディレクトリ。 */
export const SERVER_DIR = serverDirOf(import.meta.url);

/** Praeforma リポジトリ root (skills/ と web/ の基点)。 */
export const REPO_ROOT = resolve(SERVER_DIR, '..');

/** リポジトリ root からの相対パスを絶対パスにする。 */
export function repoPath(...segments: string[]): string {
  return resolve(REPO_ROOT, ...segments);
}
