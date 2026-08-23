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
    // Screen Flow (spec/feature/screen-flow.md §6.3)。 未設定時は該当機能を
    // 未接続表示 + 操作 disabled にする (mock 禁止)。 起動は妨げない。
    // bearer の PRAEFORMA_CC_TOKEN は secret なので infraKeys ではなく
    // Infisical 側で供給する (.env に平文で書かせない)。
    PRAEFORMA_CLAUDE_MODEL: "",
    PRAEFORMA_ANATOMIA_URL: "",
    PRAEFORMA_CC_URL: "",
    PRAEFORMA_CC_TEMPLATE: "",
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
