// 企画概要書 (spec/feature/concept-sheet.md) と UX/ゴールの追加欄 (PF-GOAL-W2) の確認。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { ConceptSheetDocument, ConceptSheetRecord } from '../../../../shared/concept-sheet.ts';

process.env.PRAEFORMA_LOCAL_MODE = '1';
const document: ConceptSheetDocument = {
  title: 'まかいぬい', catchcopy: 'かわいい魔物を、連れて帰って飼おう',
  lead: '目の前の魔物を投げ縄で捕まえ、自宅で世話をしながら同じ個体と暮らします。',
  target: '魔物と暮らす手触りを味わいたい人',
  hooks: [{ heading: '投げ縄で捕まえる', text: '上へはじいて縄を投げ、押し続けて引き寄せます。' },
    { heading: '自宅で世話をする', text: 'なでると汚れが落ち、同じ個体との関係が続きます。' }],
  journey: [{ scene: '出会う', text: '目の前の床から魔物があらわれる。' }, { scene: '捕まえる', text: '縄で引き寄せて連れ帰る。' },
    { scene: '暮らす', text: '自宅で世話をして反応を受け取る。' }],
  emotions: ['かわいい', 'いじめたい'], goal: 'この個体がここで暮らしていると感じる。', visualCaption: '',
};
const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64')}`;

test('concept sheet documents accept plain text within limits and reject tags', async () => {
  const { conceptSheetDocumentSchema } = await import('../../../../shared/concept-sheet.ts');
  assert.equal(conceptSheetDocumentSchema.safeParse(document).success, true);
  assert.equal(conceptSheetDocumentSchema.safeParse({ ...document, catchcopy: '<script>x</script>' }).success, false);
  assert.equal(conceptSheetDocumentSchema.safeParse({ ...document, catchcopy: 'あ'.repeat(41) }).success, false);
  assert.equal(conceptSheetDocumentSchema.safeParse({ ...document, hooks: document.hooks.slice(0, 1) }).success, false);
});

test('key visuals are checked by declared type, content signature and size', async () => {
  const { decodeKeyVisual } = await import('../concept-sheet-input.ts');
  const ok = decodeKeyVisual(PNG);
  assert.equal(ok.visual.mimeType, 'image/png');
  assert.equal(ok.visual.digest.length, 64);
  const status = (value: string): number | undefined => { try { decodeKeyVisual(value); return undefined; } catch (e) { return (e as { status?: number }).status; } };
  assert.equal(status(PNG.replace('image/png', 'image/jpeg')), 400);
  assert.equal(status('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), 400);
  const huge = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(4 * 1024 * 1024)]).toString('base64')}`;
  assert.equal(status(huge), 413);
});

test('the one-page HTML escapes text and embeds only safe image data', async () => {
  const { renderConceptSheetHtml } = await import('../../../../shared/concept-sheet-html.ts');
  const html = renderConceptSheetHtml({ projectName: '<b>&"\'', document: { ...document, lead: 'A & B "C"' }, keyVisualDataUrl: PNG, footer: 'x' });
  assert.match(html, /&lt;b&gt;&amp;&quot;&#39;/);
  assert.match(html, /A &amp; B &quot;C&quot;/);
  assert.match(html, /<img src="data:image\/png;base64,/);
  assert.doesNotMatch(html, /<script/i);
  const unsafe = renderConceptSheetHtml({ projectName: 'p', document, keyVisualDataUrl: 'javascript:alert(1)', footer: 'x' });
  assert.doesNotMatch(unsafe, /javascript:/);
  assert.match(unsafe, /キービジュアル未設定/);
});

test('concept sheets are generated from the UX goal, edited by revision and marked outdated', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeConceptSheetRouter } = await import('../../routes/concept-sheets.ts');
  const { makeProjectUxGoalRouter } = await import('../../routes/project-ux-goal.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:'); assert.equal(state.ok, true, state.error ?? undefined);
  const close = getLocalSqlite() as unknown as { close(): void };
  try {
    const identify = (userId: string): void => enableLocalAuth({ userId, displayName: null, role: 'user', projectKey: null });
    identify('author');
    await getDb().insert(projects).values([{ id: 'p', name: 'Mp', orgId: 'test', ownerUserId: 'author' },
      { id: 'other', name: 'Other', orgId: 'test', ownerUserId: 'author' }]);
    await getDb().insert(projectMembers).values([{ id: 'a', projectId: 'p', userId: 'author', role: 'owner' },
      { id: 'b', projectId: 'other', userId: 'author', role: 'owner' }, { id: 'c', projectId: 'p', userId: 'reader', role: 'viewer' }]);
    let seen: { hasVisual: boolean; story: string } | undefined;
    const app = new Hono(); app.onError((e) => new Response(JSON.stringify({ error: e.message }), { status: e instanceof AppError ? e.status : 500 }));
    app.route('/projects/:pid/concept-sheets', makeConceptSheetRouter('unused', async (_bin, material, keyVisual) => {
      seen = { hasVisual: keyVisual !== null, story: material.ux.story };
      return { document: structuredClone(document), skillDigest: 'skill' };
    }));
    app.route('/projects/:pid/ux-goal', makeProjectUxGoalRouter());
    const request = (path: string, method: string, body?: unknown) => app.request(path,
      { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const id = randomUUID();

    // UX/ゴールが空のうちは作らない。
    assert.equal((await request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 0, keyVisual: null })).status, 422);
    // PF-GOAL-W2: story / emotions は保存でき、省略した PUT では消えない。
    assert.equal((await request('/projects/p/ux-goal', 'PUT', { experience: '魔物の実在性', design: 'かわいいものをいじめたい', goal: '暮らしている',
      story: '出会う → 捕まえる → 暮らす', emotions: 'かわいい / いじめたい', expectedRevision: 0 })).status, 200);
    assert.equal((await request('/projects/p/ux-goal', 'PUT', { experience: '魔物の実在性', design: 'かわいいものをいじめたい', goal: '暮らしている', expectedRevision: 1 })).status, 200);
    const goal = await (await app.request('/projects/p/ux-goal')).json() as { definition: { story: string; emotions: string; revision: number } };
    assert.equal(goal.definition.story, '出会う → 捕まえる → 暮らす'); assert.equal(goal.definition.emotions, 'かわいい / いじめたい'); assert.equal(goal.definition.revision, 2);

    assert.equal((await request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 0, keyVisual: PNG })).status, 201);
    assert.deepEqual(seen, { hasVisual: true, story: '出会う → 捕まえる → 暮らす' });
    assert.equal((await request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 0, keyVisual: null })).status, 409);
    assert.equal((await request('/projects/other/concept-sheets/' + id, 'GET')).status, 404);
    const read = async (): Promise<ConceptSheetRecord> => (await (await app.request(`/projects/p/concept-sheets/${id}`)).json() as { sheet: ConceptSheetRecord }).sheet;
    let sheet = await read();
    assert.equal(sheet.status, 'generated'); assert.equal(sheet.freshness, 'current'); assert.equal(sheet.keyVisual?.mimeType, 'image/png');

    identify('reader');
    assert.equal((await request('/projects/p/concept-sheets/generate', 'POST', { id: randomUUID(), expectedRevision: 0, keyVisual: null })).status, 403);
    assert.equal((await app.request('/projects/p/concept-sheets')).status, 200);
    identify('author');

    const edited = { ...document, catchcopy: 'かわいいから、いじめたくなる' };
    assert.equal((await request(`/projects/p/concept-sheets/${id}`, 'PUT', { document: edited, expectedRevision: 1 })).status, 200);
    assert.equal((await request(`/projects/p/concept-sheets/${id}`, 'PUT', { document: edited, expectedRevision: 1 })).status, 409);
    sheet = await read(); assert.equal(sheet.status, 'edited'); assert.equal(sheet.document.catchcopy, edited.catchcopy);

    // 作り直しで保存済みのキービジュアルを使い続けられる。
    assert.equal((await request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 2, keyVisual: 'keep' })).status, 200);
    assert.equal(seen?.hasVisual, true);

    await getDb().update(projects).set({ uxGoal: '変わった' }).where(eq(projects.id, 'p'));
    sheet = await read(); assert.equal(sheet.freshness, 'outdated');
    const list = await (await app.request('/projects/p/concept-sheets')).json() as { items: Array<{ id: string; freshness: string }> };
    assert.deepEqual(list.items.map((i) => [i.id, i.freshness]), [[id, 'outdated']]);

    assert.equal((await request(`/projects/p/concept-sheets/${id}?expectedRevision=1`, 'DELETE')).status, 409);
    assert.equal((await request(`/projects/p/concept-sheets/${id}?expectedRevision=3`, 'DELETE')).status, 200);
    assert.equal((await app.request(`/projects/p/concept-sheets/${id}`)).status, 404);
  } finally { close.close(); }
});
