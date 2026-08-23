// 起動時 env 解決。 bootstrap が ensureEnv() を呼んだ後に評価される。

export interface AppConfig {
  port: number;
  databaseUrl: string;
  cernereBaseUrl: string;
  publicUrl: string;
  projectKey: string;
  /** 要件サジェスト用 LLM = claude CLI のバイナリ (LUDIARS 規約: API 不使用、 claude -p)。 */
  claudeBin: string;
  /** MUSA(Thaleia) リレーの base URL。 未設定なら Anatomia リンクは明示エラー (無言 fallback 禁止)。 */
  musaRelayUrl: string | null;
  /** MUSA リレーの bearer token (任意)。 */
  musaRelayToken: string | null;
  /** claude CLI に固定で渡す --model (任意、 未設定なら付けない)。 */
  claudeModel: string | null;
  /** Anatomia web の base URL (ドメイン正本の読み取り)。 未設定なら突合は明示エラー。 */
  anatomiaUrl: string | null;
  /** Concordia base URL / bearer / 既定 delegation template。 未設定なら Cc 送出は明示エラー。 */
  ccUrl: string | null;
  ccToken: string | null;
  ccTemplate: string | null;
  /** ローカル「仕様書レビュー」モード: SQLite + Cernere 不要 + 固定ローカルユーザ。 */
  localMode: boolean;
  /** ローカル SQLite ファイルパス。 */
  localDbPath: string;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PRAEFORMA_PORT ?? 8889),
    databaseUrl:
      process.env.PRAEFORMA_DATABASE_URL ??
      'postgres://praeforma:praeforma@localhost:5432/praeforma',
    cernereBaseUrl: process.env.CERNERE_BASE_URL ?? 'http://localhost:8080',
    publicUrl:
      process.env.PRAEFORMA_PUBLIC_URL ??
      `http://localhost:${process.env.PRAEFORMA_PORT ?? 8889}`,
    projectKey: process.env.PRAEFORMA_PROJECT_KEY ?? 'praeforma',
    claudeBin: process.env.PRAEFORMA_CLAUDE_BIN ?? 'claude',
    musaRelayUrl: process.env.PRAEFORMA_MUSA_URL ?? null,
    musaRelayToken: process.env.PRAEFORMA_MUSA_TOKEN ?? null,
    claudeModel: process.env.PRAEFORMA_CLAUDE_MODEL ?? null,
    anatomiaUrl: process.env.PRAEFORMA_ANATOMIA_URL ?? null,
    ccUrl: process.env.PRAEFORMA_CC_URL ?? null,
    ccToken: process.env.PRAEFORMA_CC_TOKEN ?? null,
    ccTemplate: process.env.PRAEFORMA_CC_TEMPLATE ?? null,
    localMode:
      process.env.PRAEFORMA_LOCAL_MODE === '1' || process.env.PRAEFORMA_LOCAL_MODE === 'true',
    localDbPath: process.env.PRAEFORMA_LOCAL_DB ?? '.praeforma-local/praeforma.sqlite',
  };
}
