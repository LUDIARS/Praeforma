import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readActioImplementation } from '../actio-implementation.ts';
import { specificationFingerprint } from '../implementation-manifest.ts';

test('implementation status uses Actio API client authentication and never treats connection failure as done', async () => {
  const keys = ['PRAEFORMA_ACTIO_URL', 'PRAEFORMA_ACTIO_CLIENT_ID', 'PRAEFORMA_ACTIO_CLIENT_SECRET'] as const;
  const before = keys.map(key => process.env[key]); const originalFetch = globalThis.fetch;
  try {
    keys.forEach(key => delete process.env[key]);
    assert.equal((await readActioImplementation('p', 'team', 'reader')).state, 'unavailable');
    process.env.PRAEFORMA_ACTIO_URL = 'https://actio.example.test';
    process.env.PRAEFORMA_ACTIO_CLIENT_ID = 'test-client'; process.env.PRAEFORMA_ACTIO_CLIENT_SECRET = 'test-secret';
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), 'https://actio.example.test/api/teams/team/planning/praeforma/projects/p/implementation/service');
      assert.equal(new Headers(init?.headers).get('X-Decided-By'), 'reader');
      assert.equal(new Headers(init?.headers).get('X-API-Client-ID'), 'test-client');
      assert.equal(init?.redirect, 'error');
      return Response.json({ projectId: 'p', items: [{ kind: 'scenario', id: 's', title: '庭', specificationRevision: 'v2',
        state: 'awaiting_confirmation', tasks: [{ id: 'task', title: '実装', status: 'done', isBacklog: false }], confirmation: null }] });
    };
    const result = await readActioImplementation('p', 'team', 'reader');
    assert.equal(result.items[0]?.state, 'awaiting_confirmation');
    globalThis.fetch = async () => new Response('', { status: 403 });
    assert.equal((await readActioImplementation('p', 'team', 'reader')).state, 'unavailable');
    globalThis.fetch = async () => Response.json({ projectId: 'foreign', items: [] });
    assert.equal((await readActioImplementation('p', 'team', 'reader')).state, 'unavailable');
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => { if (before[index] === undefined) delete process.env[key]; else process.env[key] = before[index]; });
  }
});
test('specification fingerprints preserve content changes while ignoring object key order', () => {
  const before = specificationFingerprint({ revision: 1, canvas: { x: 2, y: 3 } });
  assert.equal(before, specificationFingerprint({ canvas: { y: 3, x: 2 }, revision: 1 }));
  assert.notEqual(before, specificationFingerprint({ revision: 2, canvas: { x: 2, y: 3 } }));
});
