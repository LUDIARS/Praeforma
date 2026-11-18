// 実行モードの単一判定。 schema ファイル・connection が import 時に参照するので、
// local.ts が import より前に PRAEFORMA_LOCAL_MODE を立てておく必要がある。
//
// LOCAL_MODE は「Cernere を使わない個人用モード (認証なし・127.0.0.1)」。
// 保存先は LOCAL_STORAGE で別に選ぶ (spec/feature/postgres-primary.md)。
// 個人用モードの既定は sqlite、PRAEFORMA_LOCAL_STORAGE=postgres で Postgres を正本にする。
// 通常 (複数人) モードは常に Postgres。

export type LocalStorage = 'sqlite' | 'postgres';

export const LOCAL_MODE =
  process.env.PRAEFORMA_LOCAL_MODE === '1' || process.env.PRAEFORMA_LOCAL_MODE === 'true';

/** PRAEFORMA_LOCAL_STORAGE を読む。未設定は sqlite。知らない値は起動を止める (黙って別の DB を使わない)。 */
export function parseLocalStorage(value: string | undefined): LocalStorage {
  const v = value?.trim().toLowerCase();
  if (!v || v === 'sqlite') return 'sqlite';
  if (v === 'postgres') return 'postgres';
  throw new Error(`PRAEFORMA_LOCAL_STORAGE must be "sqlite" or "postgres" (got "${value}")`);
}

export const LOCAL_STORAGE: LocalStorage = LOCAL_MODE ? parseLocalStorage(process.env.PRAEFORMA_LOCAL_STORAGE) : 'postgres';

/** 埋め込み SQLite を使うか。schema の方言選択はこれを見る。 */
export const SQLITE_STORAGE = LOCAL_STORAGE === 'sqlite';
