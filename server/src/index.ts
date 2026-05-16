// Praeforma server entry — Hono + Drizzle + Cernere PASETO V4。
//
// Step 1 (server scaffold) スコープ:
//   - healthz
//   - /api/auth/me (= PASETO 検証 + 自分の identity 返却)
//   - DB 初期化 (失敗しても healthz は 200、 db: "down" 表示)
//
// Step 2 で routes/* (projects/domains/objects/layouts/specs CRUD) を追加する。

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';

import { loadConfig } from './config.ts';
import { initDb, getDbState } from './db/connection.ts';
import { startPaseto } from './auth/paseto.ts';
import { requireAuth, getIdentity } from './middleware/require-auth.ts';
import { AppError } from './lib/errors.ts';
import { makeReferenceRouter } from './routes/references.ts';
import { makeFeedbackRouter } from './routes/feedback.ts';

const config = loadConfig();

// DB 接続 (失敗しても起動継続)
const dbState = await initDb(config.databaseUrl);

// Cernere PASETO 検証準備
startPaseto({
  cernereBaseUrl: config.cernereBaseUrl,
  audience: config.publicUrl,
});

const app = new Hono();

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['content-type', 'authorization'],
  }),
);

// AppError → JSON
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.status as 400 | 401 | 403 | 404 | 409 | 500);
  }
  console.error('[unhandled]', err);
  return c.json({ error: 'internal_error' }, 500);
});

app.get('/api/health', (c) => {
  const s = getDbState();
  return c.json({
    ok: true,
    service: 'praeforma',
    port: config.port,
    db: s.ok ? 'connected' : 'down',
    db_error: s.error,
  });
});

app.get('/api/auth/me', requireAuth, (c) => {
  const id = getIdentity(c);
  return c.json({
    userId: id.userId,
    displayName: id.displayName,
    role: id.role,
    projectKey: id.projectKey,
  });
});

// Step 1 で公開する最小 REST: references + feedback (Unity Editor 拡張と Web 双方が使う)
app.route('/api/projects/:pid/references', makeReferenceRouter());
app.route('/api/projects/:pid/feedback', makeFeedbackRouter());

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[praeforma] listening on http://localhost:${info.port}`);
  console.log(`[praeforma] db: ${dbState.ok ? 'connected' : 'down'}`);
  console.log(`[praeforma] cernere: ${config.cernereBaseUrl}`);
});
