// 実行モードの単一判定。 schema ファイル・connection が import 時に参照するので、
// local.ts が import より前に PRAEFORMA_LOCAL_MODE を立てておく必要がある。

export const LOCAL_MODE =
  process.env.PRAEFORMA_LOCAL_MODE === '1' || process.env.PRAEFORMA_LOCAL_MODE === 'true';
