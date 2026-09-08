import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

process.env.PRAEFORMA_LOCAL_MODE = '1';

test('PF-DA-1 assigns unplaced business domains and rejects invalid or competing placement', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { domains } = await import('../../db/schema/domain.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeDomainDefinitionsRouter } = await import('../../routes/domain-definitions.ts');
  const { AppError } = await import('../errors.ts');
  assert.equal((await initLocalDb(':memory:')).ok, true);
  const sqlite = getLocalSqlite()!;
  try {
    enableLocalAuth({ userId: 'assignment-test', displayName: null, role: 'user', projectKey: null });
    await getDb().insert(projects).values(['p1', 'p2'].map(id => ({
      id, name: id, orgId: 'test', ownerUserId: 'assignment-test',
    })));
    await getDb().insert(projectMembers).values({ id: 'm1', projectId: 'p1', userId: 'assignment-test', role: 'owner' });
    await getDb().insert(domains).values([
      { id: 'core', projectId: 'p1', name: 'Core', definitionKind: 'core' },
      { id: 'core2', projectId: 'p1', name: 'Other core', definitionKind: 'core' },
      { id: 'business', projectId: 'p1', name: 'Business', definitionKind: 'business', description: 'Keep description' },
      { id: 'ancestor', projectId: 'p1', name: 'Ancestor', definitionKind: 'business' },
      { id: 'nested', projectId: 'p1', name: 'Nested core', definitionKind: 'core', parentId: 'ancestor' },
      { id: 'foreign', projectId: 'p2', name: 'Foreign', definitionKind: 'business' },
      { id: 'undefined', projectId: 'p1', name: 'Unclassified' },
    ]);
    const app = new Hono();
    app.onError(error => new Response(error.message, { status: error instanceof AppError ? error.status : 500 }));
    app.route('/projects/:pid/domain-definitions', makeDomainDefinitionsRouter({ anatomiaUrl: null }));
    const assign = async (core: string, child: string): Promise<Response> => app.request(
      `/projects/p1/domain-definitions/${core}/business-domains/${child}`, { method: 'POST' });
    const attempts = await Promise.all([assign('core', 'business'), assign('core2', 'business')]);
    assert.deepEqual(attempts.map(result => result.status).sort(), [200, 409]);
    const saved = sqlite.prepare('SELECT parent_id, description FROM domains WHERE id = ?').all('business') as Array<{ parent_id: string; description: string }>;
    assert.ok(['core', 'core2'].includes(saved[0]!.parent_id));
    assert.equal(saved[0]!.description, 'Keep description');
    for (const [parent, child] of [
      ['nested', 'ancestor'], ['core', 'foreign'], ['core', 'undefined'],
      ['core', 'core'], ['missing', 'ancestor'], ['business', 'ancestor'],
    ]) assert.equal((await assign(parent!, child!)).status, 409);
    enableLocalAuth({ userId: 'viewer', displayName: null, role: 'user', projectKey: null });
    await getDb().insert(projectMembers).values({ id: 'm2', projectId: 'p1', userId: 'viewer', role: 'viewer' });
    assert.equal((await assign('core', 'ancestor')).status, 403);
    assert.equal((sqlite.prepare('SELECT parent_id FROM domains WHERE id = ?').all('ancestor') as Array<{ parent_id: null }>)[0]!.parent_id, null);
  } finally { (sqlite as unknown as { close(): void }).close(); }
});
