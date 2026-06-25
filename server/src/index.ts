// Praeforma server entry — Hono + Drizzle + Cernere PASETO V4。
//
// Step 1 (server scaffold) スコープ:
//   - healthz
//   - /api/auth/me (= PASETO 検証 + 自分の identity 返却)
//   - DB 初期化 (失敗しても healthz は 200、 db: "down" 表示)
//
// Step 2 で routes/* (projects/domains/objects/layouts/specs CRUD) を追加する。

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve, type ServerType } from '@hono/node-server';
import { attachCollab } from './ws/collab.ts';

import { loadConfig } from './config.ts';
import { initDb, initLocalDb, getDbState } from './db/connection.ts';
import { startPaseto } from './auth/paseto.ts';
import { requireAuth, getIdentity, enableLocalAuth } from './middleware/require-auth.ts';
import { AppError } from './lib/errors.ts';
import { makeReferenceRouter } from './routes/references.ts';
import { makeReferenceContentRouter } from './routes/reference-content.ts';
import { makeFeedbackRouter } from './routes/feedback.ts';
import { makeProjectRouter } from './routes/projects.ts';
import { makeDomainRouter } from './routes/domains.ts';
import { makeObjectRouter } from './routes/objects.ts';
import { makeLayoutRouter } from './routes/layouts.ts';
import { makeSpecRouter } from './routes/specs.ts';
import { makeAcceptanceRouter } from './routes/acceptance.ts';
import { makeAssetRouter } from './routes/assets.ts';
import { makeStudioRouter } from './routes/studio.ts';

const config = loadConfig();

// DB 接続 (失敗しても起動継続)。 ローカルモードは SQLite、 通常は Postgres。
const dbState = config.localMode
  ? await initLocalDb(config.localDbPath)
  : await initDb(config.databaseUrl);

if (config.localMode) {
  // 仕様書レビュー用ローカルモード: Cernere を使わず固定の匿名ローカルユーザを注入。
  enableLocalAuth({
    userId: 'local-reviewer',
    role: 'owner',
    displayName: 'Local Reviewer',
    projectKey: null,
  });
  console.log('[praeforma] LOCAL MODE (sqlite + no auth) — 仕様書レビュー用');
} else {
  // Cernere PASETO 検証準備
  startPaseto({
    cernereBaseUrl: config.cernereBaseUrl,
    audience: config.publicUrl,
  });
}

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
    db: s.ok ? (config.localMode ? 'sqlite' : 'connected') : 'down',
    db_error: s.error,
    localMode: config.localMode,
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

// Step 2: core 5 CRUD + Step 1.5 で追加した references / feedback
// Step 7: acceptance / Step 10: assets / Step 13: reference content
// Studio 最小サブセット (ローカル SQLite でも動く範囲)
app.route('/api/projects', makeProjectRouter());
app.route('/api/projects/:pid/domains', makeDomainRouter());
app.route('/api/projects/:pid/objects', makeObjectRouter());
app.route('/api/projects/:pid/layouts', makeLayoutRouter());
app.route('/api/projects/:pid/specs', makeSpecRouter());
app.route('/api/projects/:pid/assets', makeAssetRouter(config.publicUrl));
// 以下は SQLite サブセット外のテーブルを使うため、 ローカルモードでは載せない
if (!config.localMode) {
  app.route('/api/projects/:pid/references', makeReferenceRouter());
  app.route('/api/projects/:pid/references', makeReferenceContentRouter());
  app.route('/api/projects/:pid/feedback', makeFeedbackRouter());
  app.route('/api/projects/:pid/acceptance', makeAcceptanceRouter());
}
// 要件定義モード (Studio): LLM サジェスト + MUSA(Thaleia) 経由 Anatomia グラフ
app.route(
  '/api/projects/:pid/studio',
  makeStudioRouter(
    { musaRelayUrl: config.musaRelayUrl, musaRelayToken: config.musaRelayToken },
    config.claudeBin,
  ),
);

// ローカルモード: ビルド済 web/dist を同一オリジンで配信 (SPA フォールバック付き)。
if (config.localMode) {
  const webDist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
  const CT: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
  };
  app.get('/*', (c) => {
    const rel = c.req.path === '/' ? '/index.html' : c.req.path;
    const file = join(webDist, rel);
    if (!file.startsWith(webDist)) return c.text('forbidden', 403);
    const ext = rel.slice(rel.lastIndexOf('.'));
    try {
      return c.body(readFileSync(file), 200, { 'content-type': CT[ext] ?? 'application/octet-stream' });
    } catch {
      // SPA ルート (/projects/.. 等) は index.html を返す
      try {
        return c.html(readFileSync(join(webDist, 'index.html'), 'utf8'));
      } catch {
        return c.text('web/dist 未ビルド — `npm run build:web` を実行してください', 503);
      }
    }
  });
}

const httpServer: ServerType = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[praeforma] listening on http://localhost:${info.port}`);
  console.log(`[praeforma] db: ${dbState.ok ? (config.localMode ? 'sqlite' : 'connected') : 'down'}`);
  if (!config.localMode) console.log(`[praeforma] cernere: ${config.cernereBaseUrl}`);
  if (config.localMode) console.log(`[praeforma] open http://localhost:${info.port}/`);
});
// WS collab は非サブセットのテーブルを使うのでローカルでは起動しない
if (!config.localMode) {
  attachCollab(httpServer as unknown as import('node:http').Server);
}
