#!/usr/bin/env node
// Augur の登録テスト (.augur/tests.jsonl) から npm を呼ぶための中継。
// Augur はシェルを介さずに argv を起動するため、Windows では `.cmd` の shim である
// npm を直接起動できず `spawn npm ENOENT` になる。node は実行ファイルなので
// 台帳は `node server/scripts/augur-npm.mjs <npm の引数...>` と書き、ここで npm を起動する。
import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const result = spawnSync(isWindows ? 'npm.cmd' : 'npm', process.argv.slice(2), {
  stdio: 'inherit',
  // Node 20 以降は .cmd をシェル無しで起動できない。引数は台帳由来の固定値だけを渡す。
  shell: isWindows,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
