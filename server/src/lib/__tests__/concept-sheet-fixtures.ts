// 企画概要書・ビジュアル素材のテストの共通の用意。*.test.ts ではないので、これ単独では走らない。
// 題材は架空の企画「ひかりの庭」。実在の企画名や非公開の企画の内容を書かない。
// db / routes は LOCAL_MODE を見て SQLite を選ぶので、import より前に立て、中身は関数の中で動的に読む。
import { Hono } from 'hono';

process.env.PRAEFORMA_LOCAL_MODE = '1';

/** 中身の先頭が PNG の小さな画像。seed ごとに digest が変わる。 */
export function tinyPng(seed = 0): string {
  return `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, seed & 0xff, 0, 0, 0]).toString('base64')}`;
}

export const COPY = '光を集めて、 庭を咲かせよう！';

/** Astra の出力の形をした紙面 (キャッチコピーとシーン名を載せる)。 */
export function sheetHtml(copy: string, label: string): string {
  return `<!doctype html><html lang="ja"><head><style>.s{width:297mm}</style></head><body><main class="s">
    <h1>${copy.replace(' ', '<br>')}</h1><p>現在の画面：${label}</p><img src="{{IMAGE_0}}" alt=""></main></body></html>`;
}

export interface TestApp {
  app: Hono;
  request(path: string, method: string, body?: unknown): Promise<Response>;
  json<T>(path: string): Promise<T>;
  identify(userId: string): void;
  close(): void;
}

/**
 * メモリ上の SQLite に、プロジェクト p (author: owner / reader: viewer) と other (author: owner) を作り、
 * mount で routes を載せた app を返す。
 */
export async function openTestApp(mount: (app: Hono) => void | Promise<void>): Promise<TestApp> {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:');
  if (!state.ok) throw new Error(state.error ?? 'sqlite_unavailable');
  const identify = (userId: string): void => enableLocalAuth({ userId, displayName: null, role: 'user', projectKey: null });
  identify('author');
  await getDb().insert(projects).values([{ id: 'p', name: 'ひかりの庭', orgId: 'test', ownerUserId: 'author' },
    { id: 'other', name: 'Other', orgId: 'test', ownerUserId: 'author' }]);
  await getDb().insert(projectMembers).values([{ id: 'a', projectId: 'p', userId: 'author', role: 'owner' },
    { id: 'b', projectId: 'other', userId: 'author', role: 'owner' }, { id: 'c', projectId: 'p', userId: 'reader', role: 'viewer' }]);
  const app = new Hono();
  app.onError((e) => new Response(JSON.stringify({ error: e.message }), { status: e instanceof AppError ? e.status : 500 }));
  await mount(app);
  const request = (path: string, method: string, body?: unknown): Promise<Response> => Promise.resolve(app.request(path,
    { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }));
  const json = async <T>(path: string): Promise<T> => (await app.request(path)).json() as Promise<T>;
  const sqlite = getLocalSqlite() as unknown as { close(): void };
  return { app, request, json, identify, close: () => sqlite.close() };
}

/** 裏で走る生成・予約が片付くまで待つ (モックはすぐ解決するので、数回イベントループを回せば足りる)。 */
export async function settle(times = 30): Promise<void> {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setImmediate(resolve));
}
