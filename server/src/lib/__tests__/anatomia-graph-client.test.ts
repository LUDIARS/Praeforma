import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchStudioGraph } from '../anatomia-graph/client.ts';
import { AppError } from '../errors.ts';

test('fetchStudioGraph: uses the configured project, token, and linked Anatomia domain', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/domain-view')) {
      return Response.json({ views: [{ domain: 'ScreenFlow', implementors: ['a1'] }] });
    }
    return Response.json({
      nodes: [{ id: 'a1', name: 'renderFlow', kind: 'function', sourceRange: { filePath: '/src/flow.ts' } }],
      edges: [],
    });
  };

  const result = await fetchStudioGraph(
    { baseUrl: 'http://anatomia.example/', token: 'test-token' },
    'owner/repo',
    { kind: 'domain', name: 'ScreenFlow' },
    '',
    1_000,
    fetchImpl,
  );

  assert.deepEqual(calls.map((call) => call.url), [
    'http://anatomia.example/api/graph?project=owner%2Frepo',
    'http://anatomia.example/api/projects/owner%2Frepo/domain-view',
  ]);
  assert.equal(new Headers(calls[0]?.init?.headers).get('authorization'), 'Bearer test-token');
  assert.deepEqual(result.nodes.map((node) => node.key), ['a1']);
});

test('fetchStudioGraph: rejects malformed upstream payloads as a gateway error', async () => {
  const fetchImpl: typeof fetch = async () => Response.json({ nodes: 'invalid', edges: [] });
  await assert.rejects(
    fetchStudioGraph(
      { baseUrl: 'http://anatomia.example', token: null },
      'demo',
      { kind: 'layout', name: 'scene' },
      '',
      1_000,
      fetchImpl,
    ),
    (error: unknown) => error instanceof AppError
      && error.message === 'anatomia_bad_payload'
      && error.status === 502,
  );
});
