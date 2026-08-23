const DEFAULT_DATABASE_URL = 'postgres://praeforma:praeforma@localhost:5432/praeforma';
const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const SQL_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

export class DbInitConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DbInitConfigError';
  }
}

export interface DbInitConfig {
  adminConnectionString: string;
  role: string;
  password: string;
  database: string;
}

/** DB bootstrap の接続設定を、秘密値をエラーへ含めず検証する。 */
export function parseDbInitConfig(
  adminConnectionString: string | undefined,
  appConnectionString: string | undefined,
): DbInitConfig {
  if (!adminConnectionString) {
    throw new DbInitConfigError(
      'PRAEFORMA_DB_ADMIN_URL が未設定です。CREATE DATABASE 権限のある接続 URL を渡してください。',
    );
  }

  let adminUrl: URL;
  let appUrl: URL;
  try {
    adminUrl = new URL(adminConnectionString);
  } catch {
    throw new DbInitConfigError('PRAEFORMA_DB_ADMIN_URL は有効な PostgreSQL URL ではありません。');
  }
  try {
    appUrl = new URL(appConnectionString ?? DEFAULT_DATABASE_URL);
  } catch {
    throw new DbInitConfigError('PRAEFORMA_DATABASE_URL は有効な PostgreSQL URL ではありません。');
  }

  if (!POSTGRES_PROTOCOLS.has(adminUrl.protocol)) {
    throw new DbInitConfigError('PRAEFORMA_DB_ADMIN_URL の scheme は postgres/postgresql に限ります。');
  }
  if (!POSTGRES_PROTOCOLS.has(appUrl.protocol)) {
    throw new DbInitConfigError('PRAEFORMA_DATABASE_URL の scheme は postgres/postgresql に限ります。');
  }

  let role: string;
  let password: string;
  let database: string;
  try {
    role = decodeURIComponent(appUrl.username);
    password = decodeURIComponent(appUrl.password);
    database = decodeURIComponent(appUrl.pathname.replace(/^\//, ''));
  } catch {
    throw new DbInitConfigError('PRAEFORMA_DATABASE_URL に不正な percent encoding があります。');
  }

  if (!SQL_IDENTIFIER.test(role) || !SQL_IDENTIFIER.test(database)) {
    throw new DbInitConfigError('role/database 名は ^[a-z_][a-z0-9_]*$ に限ります。');
  }
  if (!password || password.includes('\0')) {
    throw new DbInitConfigError('PRAEFORMA_DATABASE_URL の password は空または NUL を含められません。');
  }

  return { adminConnectionString, role, password, database };
}
