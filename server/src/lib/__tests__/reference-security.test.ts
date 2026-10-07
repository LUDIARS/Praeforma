import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { Hono } from 'hono';
import { AppError } from '../errors.ts';
import contract from '../../../contracts/reference-project.contract.ts';
process.env.PRAEFORMA_LOCAL_MODE = '0';

test('P2 project predicate rejects absent and foreign references', async () => {
  const { referenceBelongsToProject } = await import('../reference-access.ts');
  for (const reference of [undefined, { projectId: 'a' }, { projectId: 'b' }]) {
    const result = referenceBelongsToProject(reference, 'a');
    assert.equal(contract.post(result, reference, 'a'), true);
    assert.equal(result, reference?.projectId === 'a');
  }
});

test('P2 every reference route enforces membership and project-scoped SQL before content fetch/delete', async () => {
  // In-memory pg protocol fake: no socket, production DB or credentials are accessed.
  let role: string | undefined = 'owner';
  const queries: Array<{ text: string; values: unknown[] }> = [];
  let deletes = 0;
  let referenceId = 'own-ref';
  mock.method(pg.Pool.prototype, 'query', async (query: string | { text: string }, values: unknown[] = []) => {
    const text = typeof query === 'string' ? query : query.text;
    queries.push({ text, values });
    if (/SELECT 1/i.test(text)) return { rows: [] };
    if (text.includes('project_members')) return { rows: role ? [[role]] : [] };
    if (text.startsWith('SELECT id FROM projects')) return { rows: values[0] === values[1] ? [{ id: values[0] }] : [] };
    if (text.includes('external_references')) {
      if (/^insert/i.test(text)) { referenceId = String(values[0]); return { rows: [] }; }
      assert.match(text, /"project_id"\s*=\s*\$\d+/);
      assert.equal(values[0], 'a', 'project must be bound, never a rid-only query');
      if (/^delete/i.test(text)) { deletes++; return { rows: [] }; }
      const byId = /"external_references"\."id"\s*=/.test(text);
      if (byId && values[1] !== referenceId) return { rows: [] };
      return { rows: [[referenceId, 'a', 'project', 'a', 'web', 'https://example.test', 'doc', null,
        'link', 0, 'user', '2026-10-07T00:00:00Z', '2026-10-07T00:00:00Z']] };
    }
    throw new Error(`unexpected SQL: ${text}`);
  });
  const { initDb, getDbState } = await import('../../db/connection.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeReferenceRouter } = await import('../../routes/references.ts');
  const { makeReferenceContentRouter } = await import('../../routes/reference-content.ts');
  const app = new Hono();
  app.onError((error, c) => c.json({ error: error.message }, error instanceof AppError ? error.status as 400 : 500));
  app.route('/api/projects/:pid/references', makeReferenceRouter());
  app.route('/api/projects/:pid/references', makeReferenceContentRouter());
  const base = '/api/projects/a/references';
  const create = (target = 'a'): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ target_kind: 'project', target_id: target, url: 'https://example.test', title: 'doc' }) });
  try {
    assert.equal((await initDb('postgres://fake:fake@invalid.test/fake')).ok, true);
    assert.equal((await app.request(`${base}?target_kind=project&target_id=a`)).status, 401);
    enableLocalAuth({ userId: 'user', role: 'user', displayName: null, projectKey: null });
    role = undefined;
    for (const [path, init] of [[`${base}?target_kind=project&target_id=a`, undefined], [base, create()],
      [`${base}/own-ref`, { method: 'DELETE' }], [`${base}/own-ref/content`, undefined]] as const) {
      assert.equal((await app.request(path, init)).status, 403);
    }
    assert.equal(queries.some(q => q.text.includes('external_references')), false);
    role = 'viewer';
    assert.equal((await app.request(`${base}?target_kind=project&target_id=a`)).status, 200);
    assert.equal((await app.request(base, create())).status, 403);
    assert.equal((await app.request(`${base}/own-ref`, { method: 'DELETE' })).status, 403);
    role = 'owner';
    assert.equal((await app.request(`${base}/foreign-ref/content`)).status, 404);
    assert.equal((await app.request(`${base}/foreign-ref`, { method: 'DELETE' })).status, 404);
    assert.equal(deletes, 0);
    assert.equal((await app.request(base, create('b'))).status, 404);
    assert.equal((await app.request(`${base}?target_kind=project&target_id=b`)).status, 404);
    assert.equal((await app.request(`${base}/own-ref/content`)).status, 501, 'authorized unsupported content keeps normal behavior');
    assert.equal((await app.request(base, create())).status, 201);
    assert.equal((await app.request(`${base}/${referenceId}`, { method: 'DELETE' })).status, 200);
    assert.equal(deletes, 1);
  } finally { await getDbState().pool?.end(); mock.restoreAll(); }
});
