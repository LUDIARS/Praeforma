// requireAuth — Bearer token (PASETO V4) を検証して identity を c.set('auth', ...) する。

import type { Context, MiddlewareHandler } from 'hono';
import { verifyPaseto, type AuthIdentity } from '../auth/paseto.ts';
import { AppError } from '../lib/errors.ts';

function extractToken(c: Context): string | null {
  const h = c.req.header('authorization');
  if (h && h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  return null;
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
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
