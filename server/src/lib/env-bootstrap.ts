/**
 * env-bootstrap — Memoria / Bibliotheca と同じパターン。
 *
 * machine identity (INFISICAL_*) を Excubitor / .env.secrets / host env で
 * 受け取り、 Infisical からアプリ secret を fetch + inject する。
 */

const WANTED_KEYS: readonly string[] = [
  'PRAEFORMA_DATABASE_URL',
  'CERNERE_BASE_URL',
  'PRAEFORMA_PUBLIC_URL',
];

export interface InfisicalCreds {
  siteUrl: string;
  projectId: string;
  environment: string;
  clientId: string;
  clientSecret: string;
}

interface InfisicalSecret { secretKey: string; secretValue: string }

function credsFromEnv(): InfisicalCreds | null {
  const siteUrl = process.env.INFISICAL_SITE_URL?.replace(/\/$/, '');
  const projectId = process.env.INFISICAL_PROJECT_ID;
  const environment = process.env.INFISICAL_ENVIRONMENT ?? 'dev';
  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  if (!siteUrl || !projectId || !clientId || !clientSecret) return null;
  return { siteUrl, projectId, environment, clientId, clientSecret };
}

async function fetchSecrets(creds: InfisicalCreds): Promise<InfisicalSecret[]> {
  const siteUrl = creds.siteUrl.replace(/\/$/, '');
  const loginRes = await fetch(
    `${siteUrl}/api/v1/auth/universal-auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
      }),
    },
  );
  if (!loginRes.ok) {
    throw new Error(`Infisical login failed: ${loginRes.status}`);
  }
  const { accessToken } = (await loginRes.json()) as { accessToken: string };

  const params = new URLSearchParams({
    workspaceId: creds.projectId,
    environment: creds.environment,
    secretPath: '/',
  });
  const secretsRes = await fetch(
    `${siteUrl}/api/v3/secrets/raw?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!secretsRes.ok) {
    throw new Error(`Infisical secrets fetch failed: ${secretsRes.status}`);
  }
  const { secrets } = (await secretsRes.json()) as {
    secrets: InfisicalSecret[];
  };
  return secrets;
}

function injectSecrets(secrets: InfisicalSecret[]): number {
  let injected = 0;
  for (const s of secrets) {
    if (!process.env[s.secretKey]) {
      process.env[s.secretKey] = s.secretValue;
      injected++;
    }
  }
  return injected;
}

export interface EnsureEnvResult {
  ok: boolean;
  injected: number;
  reason?: 'no_creds' | 'infisical_error';
  message?: string;
}

export async function ensureEnv(): Promise<EnsureEnvResult> {
  const creds = credsFromEnv();
  if (!creds) {
    return { ok: false, injected: 0, reason: 'no_creds' };
  }
  try {
    const secrets = await fetchSecrets(creds);
    const injected = injectSecrets(secrets);
    console.log(`[env-bootstrap] injected ${injected} secrets from Infisical`);
    return { ok: true, injected };
  } catch (err) {
    const message = (err as Error).message;
    console.warn(`[env-bootstrap] ${message} — Infisical をスキップして起動`);
    return { ok: false, injected: 0, reason: 'infisical_error', message };
  }
}

export function hasInfisicalCreds(): boolean {
  return credsFromEnv() !== null;
}

export function missingWantedKeys(): string[] {
  return WANTED_KEYS.filter((k) => !process.env[k]);
}
