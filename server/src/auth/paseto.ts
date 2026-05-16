// Cernere PASETO V4 検証 (Memoria multi/paseto-verifier.js を移植)。
//
// `GET /.well-known/cernere-public-key` から公開鍵を 6h ごとに refresh し、
// in-memory cache で kid を試行する。 Cernere 不到達でも cached key で検証は継続。

import { V4 } from 'paseto';

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface KeyEntry {
  key: Buffer;
  fetchedAt: number;
}

const keyCache = new Map<string, KeyEntry>();
let refreshTimer: NodeJS.Timeout | null = null;

export interface AuthIdentity {
  userId: string;
  role: string;
  displayName: string | null;
  projectKey: string | null;
}

interface PasetoOptions {
  cernereBaseUrl: string;
  audience: string;
}

let optsRef: PasetoOptions | null = null;

export function startPaseto(opts: PasetoOptions): void {
  optsRef = opts;
  void refreshPublicKeys();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => void refreshPublicKeys(), REFRESH_INTERVAL_MS);
  refreshTimer.unref?.();
}

async function refreshPublicKeys(): Promise<void> {
  if (!optsRef) return;
  try {
    const res = await fetch(
      `${optsRef.cernereBaseUrl}/.well-known/cernere-public-key`,
    );
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const body = (await res.json()) as {
      keys?: Array<{ kid: string; public_key: string }>;
    };
    const keys = Array.isArray(body?.keys) ? body.keys : [];
    let added = 0;
    for (const k of keys) {
      if (!k?.kid || !k?.public_key) continue;
      const buf = Buffer.from(k.public_key, 'base64');
      if (buf.length !== 32) {
        console.warn(`[paseto] skipped kid=${k.kid} length=${buf.length}`);
        continue;
      }
      keyCache.set(k.kid, { key: buf, fetchedAt: Date.now() });
      added++;
    }
    console.log(`[paseto] public keys refreshed: +${added} total=${keyCache.size}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[paseto] refresh failed: ${msg} (cache=${keyCache.size})`);
  }
}

export async function verifyPaseto(token: string): Promise<AuthIdentity | null> {
  if (!optsRef) return null;
  if (typeof token !== 'string') return null;
  if (!token.startsWith('v4.public.')) return null;

  for (const [kid, entry] of keyCache.entries()) {
    try {
      const result = (await V4.verify(token, entry.key, {
        complete: true,
        audience: optsRef.audience || undefined,
      })) as { payload?: Record<string, unknown> } | Record<string, unknown>;
      const payload = (
        'payload' in result && result.payload ? result.payload : result
      ) as Record<string, unknown>;
      if (payload.kind !== 'user_for_project') {
        console.warn(`[paseto] rejected kind=${payload.kind} kid=${kid}`);
        return null;
      }
      void kid;
      const userId = typeof payload.sub === 'string' ? payload.sub : null;
      if (!userId) return null;
      return {
        userId,
        role: typeof payload.role === 'string' ? payload.role : 'general',
        displayName:
          typeof payload.displayName === 'string' ? payload.displayName : null,
        projectKey:
          typeof payload.projectKey === 'string' ? payload.projectKey : null,
      };
    } catch {
      // try next kid
    }
  }
  return null;
}
