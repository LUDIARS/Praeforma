// ローカル「仕様書レビュー」モードの起動口。
// bootstrap.ts(Infisical) を経由せず、 PRAEFORMA_LOCAL_MODE を立ててから index.ts を読み込む。
// → SQLite + Cernere 不要 + 固定ローカルユーザで起動する (config / schema が import 時に参照)。

export {};

process.env.PRAEFORMA_LOCAL_MODE = '1';
if (!process.env.PRAEFORMA_PORT) process.env.PRAEFORMA_PORT = '8889';

await import('./index.ts');
