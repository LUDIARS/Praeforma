// requireAuth — Bearer token (PASETO V4) を検証して identity を c.set('auth', ...) する。

import type { Context, MiddlewareHandler } from 'hono';
import { verifyPaseto, type AuthIdentity } from '../auth/paseto.ts';
import { AppError } from '../lib/errors.ts';

function extractToken(c: Context): string | null {
  const h = c.req.header('authorization');
  if (h && h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  return null;
}

// ローカル「仕様書レビュー」モードでは Cernere 検証をバイパスし、 固定の匿名ローカル
// ユーザを注入する (個人データを持たない)。 index.ts が起動時に enableLocalAuth を呼ぶ。
let localIdentity: AuthIdentity | null = null;
export function enableLocalAuth(identity: AuthIdentity): void {
  localIdentity = identity;
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (localIdentity) {
    c.set('auth', localIdentity);
    await next();
    return;
  }
  const token = extractToken(c);
  if (!token) throw AppError.unauthorized();
  const identity = await verifyPaseto(token);
  if (!identity) throw AppError.unauthorized('invalid_token');
  c.set('auth', identity);
  await next();
};

export function getIdentity(c: Context): AuthIdentity {
  const id = c.get('auth') as AuthIdentity | undefined;
  if (!id) throw new Error('auth identity missing — requireAuth not mounted');
  return id;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthIdentity;
  }
}
