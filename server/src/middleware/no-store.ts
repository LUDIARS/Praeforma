import type { MiddlewareHandler } from 'hono';

// UI調整期間のキャッシュ無効化 (spec/tasks/2026-09-08-temporary-no-cache.md)。

/** UI調整期間はAPI・HTML・配信アセットを再利用させない（再開時はこのmiddlewareを外す）。 */
export const noStoreResponses: MiddlewareHandler = async (context, next) => {
  await next();
  context.header('Cache-Control', 'no-store, max-age=0');
  context.header('CDN-Cache-Control', 'no-store');
  context.header('Cloudflare-CDN-Cache-Control', 'no-store');
  context.header('Pragma', 'no-cache');
  context.header('Expires', '0');
};
