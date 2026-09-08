import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CcChatClient, type CcChatSession } from '../cc-chat-client.ts';
process.env.PRAEFORMA_LOCAL_MODE = '1';

test('PF-CHAT durable binding: first send, concurrency, reconnect, provider resume and explicit clear', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects } = await import('../../db/schema/project.ts');
  const { LlmChatService } = await import('../llm-chat-service.ts');
  const { readChat } = await import('../../db/llm-chat-store.ts');
  assert.equal((await initLocalDb(':memory:')).ok, true);
  const sqlite = getLocalSqlite()!;
  const sessions: CcChatSession[] = [];
  const spawns: Array<{ args: string[]; prompt: string }> = [];
  let injects = 0, stops = 0;
  const anchor = '12345678-1234-1234-1234-123456789abc';
  const fakeFetch: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === '/v1/admin/spawn-session') {
      const body = JSON.parse(String(init?.body)) as { args: string[]; prompt: string };
      spawns.push(body);
      sessions.unshift({ id: `s${spawns.length}`, status: 'active', repo_path: '/task/Praeforma', started_at: 1,
        metadata: { discord_startup_task: body.prompt } });
      return Response.json({ ok: true, cwd: '/task/Praeforma' });
    }
    if (path === '/v1/sessions') return Response.json({ sessions });
    if (path.endsWith('/messages')) return Response.json({ messages: [{ id: 1, author_type: 'assistant', content: '回答', ts: 2 }] });
    if (path.endsWith('/transcript')) return Response.json({ entries: [{ payload: { claude_uuid: anchor } }] });
    if (path.endsWith('/inject')) { injects++; return Response.json({ ok: true }); }
    if (path.startsWith('/v1/admin/stop-session/')) { stops++; return Response.json({ ok: true }); }
    const id = path.split('/').at(-1);
    const session = sessions.find(item => item.id === id);
    return session ? Response.json({ session }) : Response.json({}, { status: 404 });
  };
  try {
    await getDb().insert(projects).values({ id: 'p', name: 'Praeforma', orgId: 'test', ownerUserId: 'u' });
    const service = new LlmChatService(new CcChatClient({ ccUrl: 'http://cc.test', ccToken: null }, fakeFetch), () => 1000);
    assert.equal((await service.view('p', 'u')).state, 'empty');
    assert.equal(spawns.length, 0);
    const sent = await Promise.allSettled([service.send('p', 'u', '相談'), service.send('p', 'u', '相談')]);
    assert.equal(sent.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(spawns.length, 1);
    assert.deepEqual(spawns[0]!.args, []); // Do not pin Claude IDs: Lictor relay relies on its actual transcript.
    assert.equal((await service.view('p', 'u')).state, 'ready');
    assert.equal((await service.view('p', 'other-user')).state, 'empty');
    const reloaded = new LlmChatService(new CcChatClient({ ccUrl: 'http://cc.test', ccToken: null }, fakeFetch));
    await reloaded.resume('p', 'u');
    assert.equal(spawns.length, 1);
    await reloaded.send('p', 'u', '追記');
    assert.equal(injects, 1);
    const fragments = sqlite.prepare('SELECT content FROM spec_fragments WHERE project_id=?').all('p');
    assert.equal(fragments.length, 2);
    sessions[0]!.status = 'ended';
    await reloaded.resume('p', 'u');
    assert.deepEqual(spawns[1]!.args, ['--resume', anchor]);
    await reloaded.view('p', 'u');
    assert.equal((await readChat('p', 'u')).record?.sessions.length, 2);
    await reloaded.clear('p', 'u');
    assert.equal(stops, 1);
    assert.equal((await reloaded.view('p', 'u')).state, 'empty');
    assert.equal(sqlite.prepare('SELECT content FROM spec_fragments WHERE project_id=?').all('p').length, 2);
  } finally { (sqlite as unknown as { close(): void }).close(); }
});

test('Cc timeout/unconfigured requests fail explicitly without automatic retry', async () => {
  let calls = 0;
  const client = new CcChatClient({ ccUrl: null, ccToken: null }, async () => { calls++; throw new Error('not called'); });
  await assert.rejects(client.request('/v1/sessions'), /cc_unconfigured/);
  assert.equal(calls, 0);
});
