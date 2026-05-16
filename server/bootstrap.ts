/**
 * bootstrap — Infisical で env を確定してから index.ts を起動。
 * 失敗しても落とさず .env / host env で graceful degrade。
 */

import { ensureEnv, hasInfisicalCreds, missingWantedKeys } from './src/lib/env-bootstrap.ts';

const main = async (): Promise<void> => {
  const result = await ensureEnv();
  if (result.reason === 'no_creds' && !hasInfisicalCreds()) {
    console.log(
      '[bootstrap] INFISICAL_* creds 未設定 — .env / host env のみで起動',
    );
  }
  const missing = missingWantedKeys();
  if (missing.length > 0) {
    console.warn(
      `[bootstrap] 未設定の WANTED_KEYS: ${missing.join(', ')} — 機能が degraded`,
    );
  }
  await import('./src/index.ts');
};

void main();
