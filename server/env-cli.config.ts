import type { EnvCliConfig } from "../../Cernere/packages/env-cli/src/types.js";

/**
 * Praeforma server の env-cli 設定。
 * 用法は Memoria / Bibliotheca と同じ:
 *   npm run env:setup → machine identity を .env.secrets に保存
 *   npm run env:set <K> <V> → Infisical に secret を登録
 *   npm run env:gen → .env を生成
 */

const config: EnvCliConfig = {
  name: "Praeforma (server)",

  infraKeys: {
    PRAEFORMA_PORT: "8889",
    PRAEFORMA_DATABASE_URL: "postgres://praeforma:praeforma@localhost:5432/praeforma",
    CERNERE_BASE_URL: "",
    PRAEFORMA_PUBLIC_URL: "http://localhost:8889",
    PRAEFORMA_PROJECT_KEY: "praeforma",
  },

  secretsPath: ".env.secrets",
  dotenvPath: ".env",

  defaultSiteUrl: "https://infisical.vtn-game.com",
  defaultEnvironment: "dev",

  required: {
    production: [
      "PRAEFORMA_DATABASE_URL",
      "CERNERE_BASE_URL",
      "PRAEFORMA_PUBLIC_URL",
    ],
  },
};

export default config;
