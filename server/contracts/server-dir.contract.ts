// 常駐 server の事前コンパイル起動 (server/dist/local.js) とソース直読みで同じ server/ を返すこと
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { serverDirOf } from '../src/lib/runtime-paths.ts';
import type { ContractOf } from './contract-types.ts';

/** C-8: dist/*.js なら dist の親、それ以外 (src/lib のソース) なら 2 つ上を返す。 */
export default {
  post: (dir, moduleUrl) => {
    const here = dirname(fileURLToPath(moduleUrl));
    const compiled = moduleUrl.endsWith('.js') && basename(here) === 'dist';
    const expected = compiled ? dirname(here) : dirname(dirname(here));
    return dir === expected ? true : `expected ${expected}, got ${dir}`;
  },
} satisfies ContractOf<typeof serverDirOf>;
