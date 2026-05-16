// 起動時 env 解決。 bootstrap が ensureEnv() を呼んだ後に評価される。

export interface AppConfig {
  port: number;
  databaseUrl: string;
  cernereBaseUrl: string;
  publicUrl: string;
  projectKey: string;
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
  };
}
