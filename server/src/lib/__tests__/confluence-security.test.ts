import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfluenceRequest } from '../confluence-request.ts';
import { fetchConfluence } from '../confluence-content.ts';
import contract from '../../../contracts/confluence-request.contract.ts';

const origin = 'https://docs.example.test';
const credentials = { origin, user: 'dummy-user', token: 'dummy-token' };

test('P1 fixed credential origin accepts page URLs and query page IDs', () => {
  for (const url of [`${origin}/wiki/spaces/P/pages/123/title`, `${origin}/wiki/viewpage.action?pageId=123`]) {
    const request = buildConfluenceRequest(url, origin);
    assert.equal(request.url, `${origin}/wiki/rest/api/content/123?expand=body.storage`);
    assert.equal(contract.post(request, url, origin), true);
  }
});

test('P1 rejects credential destinations before network I/O', async () => {
  let calls = 0;
  const fake: typeof fetch = async () => { calls++; return Response.json({}); };
  for (const url of ['https://evil.test/pages/123', 'http://docs.example.test/pages/123',
    'https://docs.example.test.evil.test/pages/123', 'https://docs.example.test:8443/pages/123',
    'https://u:p@docs.example.test/pages/123', 'file:///pages/123', 'invalid']) {
    await assert.rejects(fetchConfluence(url, credentials, fake));
  }
  for (const badOrigin of ['http://docs.example.test', `${origin}/wiki`, `${origin}?x=y`, 'invalid']) {
    assert.throws(() => buildConfluenceRequest(`${origin}/pages/123`, badOrigin));
  }
  assert.equal((await fetchConfluence(`${origin}/pages/123`, {}, fake)).ok, false);
  assert.equal(calls, 0);
});

test('P1 refuses every redirect and does not disclose transport errors', async () => {
  let calls = 0;
  const result = await fetchConfluence(`${origin}/pages/123`, credentials, async (input, init) => {
    calls++;
    assert.equal(String(input), `${origin}/wiki/rest/api/content/123?expand=body.storage`);
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('authorization'), `Basic ${Buffer.from('dummy-user:dummy-token').toString('base64')}`);
    throw new Error('redirect attempted: dummy-token');
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: false, errorMessage: 'confluence_fetch_failed' });
  const normal = await fetchConfluence(`${origin}/pages/123`, credentials,
    async () => Response.json({ title: 'Document', body: { storage: { value: '<p>hello</p>' } } }));
  assert.deepEqual(normal, { ok: true, title: 'Document', markdown: 'hello' });
});
