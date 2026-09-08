import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { noStoreResponses } from '../../middleware/no-store.ts';

test('UI調整期間はHTML・API・アセット・エラー応答をキャッシュしない', async () => {
  const app = new Hono();
  app.use('*', noStoreResponses);
  app.get('/', (c) => c.html('<h1>Pf</h1>'));
  app.get('/api/example', (c) => c.json({ value: 'fresh' }));
  app.get('/assets/app.js', (c) => c.body('export {};', 200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=31536000' }));
  // index.ts と同じく onError 経由で組み立てた応答にも header が乗ることを確認する。
  app.get('/api/boom', () => { throw new Error('boom'); });
  app.onError((_err, c) => c.json({ error: 'internal_error' }, 500));
  for (const path of ['/', '/api/example', '/assets/app.js', '/missing', '/api/boom']) {
    const response = await app.request(path);
    assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0');
    assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Pragma'), 'no-cache');
    assert.equal(response.headers.get('Expires'), '0');
  }
});
