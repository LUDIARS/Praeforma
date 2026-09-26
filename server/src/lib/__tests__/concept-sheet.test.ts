// 企画概要書 (spec/feature/concept-sheet.md) と UX/ゴールの追加欄 (PF-GOAL-W2 / PF-GOAL-W3) の確認。
// 題材は架空の企画「ひかりの庭」。実在の企画名や非公開の企画の内容を書かない。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { ConceptSheetRecord } from '../../../../shared/concept-sheet.ts';
import type { AstraRequest } from '../astra-cli.ts';

process.env.PRAEFORMA_LOCAL_MODE = '1';
const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64')}`;
const COPY = '光を集めて、 庭を咲かせよう！';
const LABEL = '庭の画面';

function sheetHtml(copy: string, label = LABEL): string {
  return `<!doctype html><html lang="ja"><head><style>.s{width:297mm}</style></head><body><main class="s">
    <h1>${copy.replace(' ', '<br>')}</h1><p>現在の画面：${label}</p><img src="{{IMAGE_0}}" alt=""></main></body></html>`;
}
function output(over: Record<string, unknown> = {}): string {
  return JSON.stringify({ title: 'ひかりの庭', catchcopy: COPY, concept: '庭を育てたい人に、光を集めて花を咲かせる手触りを届ける。',
    scene: { index: 0, label: LABEL, reason: '光が集まる瞬間がいちばん伝わる' }, sections: ['ポイント', '体験設計', '感情効果'],
    html: sheetHtml(COPY), error: '', ...over });
}

test('catchcopy origin follows who wrote the text', async () => {
  const { nextCatchcopyOrigin } = await import('../../../../shared/catchcopy.ts');
  assert.equal(nextCatchcopyOrigin({ text: '', origin: '' }, '人の文言'), 'human');
  assert.equal(nextCatchcopyOrigin({ text: 'AIの案', origin: 'ai' }, 'AIの案'), 'ai');
  assert.equal(nextCatchcopyOrigin({ text: 'AIの案', origin: 'ai' }, '直した文言'), 'human');
  assert.equal(nextCatchcopyOrigin({ text: '人の文言', origin: 'human' }, ''), '');
});

test('sheet HTML is checked for safety, placeholders and visible text', async () => {
  const { designHtmlIssues, finalizeConceptSheetHtml, sheetShowsText } = await import('../../../../shared/concept-sheet-html.ts');
  assert.deepEqual(designHtmlIssues(sheetHtml(COPY), 1), []);
  assert.ok(designHtmlIssues('<html><script>x</script></html>', 0).length > 0);
  assert.ok(designHtmlIssues('<html><img src="x" onerror="x"></html>', 0).length > 0);
  assert.ok(designHtmlIssues('<html><img src="https://example.com/a.png"></html>', 0).length > 0);
  assert.ok(designHtmlIssues(`<html><img src="${PNG}"></html>`, 0).length > 0);
  assert.ok(designHtmlIssues('<html><div style="background:url(//example.com/a)"></div></html>', 0).length > 0);
  assert.ok(designHtmlIssues('<html><img src="{{IMAGE_1}}"></html>', 1).length > 0);
  assert.ok(designHtmlIssues('<div>no document</div>', 0).length > 0);

  const done = finalizeConceptSheetHtml(sheetHtml(COPY), [{ dataUrl: PNG }]);
  assert.match(done, /Content-Security-Policy/);
  assert.match(done, /<img src="data:image\/png;base64,/);
  assert.doesNotMatch(finalizeConceptSheetHtml(sheetHtml(COPY), [{ dataUrl: 'javascript:alert(1)' }]), /javascript:/);

  assert.equal(sheetShowsText(sheetHtml(COPY), COPY), true, '改行位置の違いは許す');
  assert.equal(sheetShowsText(sheetHtml('光を集めて、庭を咲かせる！'), COPY), false, '1 字でも違えば載っていない');
  assert.equal(sheetShowsText('<html><style>/* 光を集めて、 庭を咲かせよう！ */</style></html>', COPY), false, 'style の中は紙面の文字ではない');
});

test('scene images are checked by declared type, content signature and size', async () => {
  const { decodeSceneImage, decodeSceneImages } = await import('../concept-sheet-input.ts');
  const ok = decodeSceneImage(LABEL, PNG);
  assert.equal(ok.image.mimeType, 'image/png');
  assert.equal(ok.image.digest.length, 64);
  const status = (fn: () => unknown): number | undefined => { try { fn(); return undefined; } catch (e) { return (e as { status?: number }).status; } };
  assert.equal(status(() => decodeSceneImage(LABEL, PNG.replace('image/png', 'image/jpeg'))), 400);
  assert.equal(status(() => decodeSceneImage(LABEL, 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')), 400);
  const big = (mb: number): string => `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(mb * 1024 * 1024)]).toString('base64')}`;
  assert.equal(status(() => decodeSceneImage(LABEL, big(4))), 413);
  const three = big(3) ; // 1 枚は上限内、6 枚で合計 16MB を超える
  assert.equal(status(() => decodeSceneImages(Array.from({ length: 6 }, (_, i) => ({ label: `画面${i}`, dataUrl: three })))), 413);
});

test('Astra output must keep the human catchcopy and name the chosen scene', async () => {
  const { checkConceptSheetOutput } = await import('../concept-sheet-design-check.ts');
  const ctx = { imageLabels: [LABEL], catchcopy: COPY };
  const ok = checkConceptSheetOutput(output(), ctx);
  assert.equal(ok.kind, 'ok');
  if (ok.kind === 'ok') { assert.equal(ok.design.catchcopy, COPY); assert.equal(ok.design.scene.label, LABEL); }

  const changed = checkConceptSheetOutput(output({ catchcopy: '光を集めて庭を咲かせよう', html: sheetHtml('光を集めて庭を咲かせよう') }), ctx);
  assert.equal(changed.kind, 'issues');
  if (changed.kind === 'issues') assert.ok(changed.issues.some((i) => i.includes(COPY)));
  assert.equal(checkConceptSheetOutput(output({ html: sheetHtml(COPY, '別の画面') }), ctx).kind, 'issues');
  assert.equal(checkConceptSheetOutput(output({ scene: { index: 3, label: LABEL, reason: '' } }), ctx).kind, 'issues');
  assert.equal(checkConceptSheetOutput(output({ error: 'ゴールが空' }), ctx).kind, 'insufficient');
  assert.equal(checkConceptSheetOutput('not json', ctx).kind, 'issues');
  // 空欄のときは Astra の案をそのまま使う。
  const own = checkConceptSheetOutput(output(), { imageLabels: [LABEL], catchcopy: '' });
  assert.equal(own.kind === 'ok' && own.design.catchcopy, COPY);
});

test('the writer asks Astra once more with the issues, then gives up', async () => {
  const { makeConceptSheetWriter } = await import('../concept-sheet-writer.ts');
  const { decodeSceneImages } = await import('../concept-sheet-input.ts');
  const material = { projectName: 'ひかりの庭', catchcopy: { text: COPY, origin: 'human' as const },
    ux: { experience: '光を集める', story: '', emotions: '', design: '', goal: '' }, cores: [], revision: 1, digest: 'd' };
  const images = decodeSceneImages([{ label: LABEL, dataUrl: PNG }]);
  const calls: AstraRequest[] = [];
  const replies = [output({ catchcopy: '別の文言' }), output()];
  const writer = makeConceptSheetWriter(async (request) => { calls.push(request); return replies.shift() ?? ''; });
  const result = await writer({ material, images, instructions: '', previous: null });
  assert.equal(result.design.catchcopy, COPY);
  assert.equal(result.model, 'gpt-6-astra');
  assert.deepEqual(calls.map((c) => c.effort), ['xhigh', 'high']);
  assert.match(calls[1]!.prompt, /直すこと/);
  assert.equal(calls[0]!.images[0]!.ext, 'png');

  const failing = makeConceptSheetWriter(async () => output({ catchcopy: '別の文言' }));
  await assert.rejects(failing({ material, images, instructions: '', previous: null }), /concept_sheet_quality_check_failed/);
});

test('generation jobs run one per project and keep only failures', async () => {
  const { ConceptSheetJobs } = await import('../concept-sheet-jobs.ts');
  const { AppError } = await import('../errors.ts');
  const jobs = new ConceptSheetJobs(() => new Date('2026-09-26T00:00:00Z'));
  let finish: () => void = () => {};
  jobs.start('p', 's1', () => new Promise<void>((resolve) => { finish = resolve; }));
  assert.equal(jobs.get('p')?.state, 'running');
  assert.throws(() => jobs.start('p', 's2', async () => {}), (e: unknown) => (e as { status?: number }).status === 429);
  finish(); await new Promise((r) => setImmediate(r));
  assert.equal(jobs.get('p'), null);
  jobs.start('p', 's3', async () => { throw new AppError('astra_timeout', 504); });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual([jobs.get('p')?.state, jobs.get('p')?.state === 'failed' && jobs.get('p')], ['failed', {
    sheetId: 's3', state: 'failed', startedAt: '2026-09-26T00:00:00.000Z', finishedAt: '2026-09-26T00:00:00.000Z', error: 'astra_timeout' }]);
});

test('concept sheets adopt the UX goal catchcopy, fill it when empty and mark outdated', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeConceptSheetRouter } = await import('../../routes/concept-sheets.ts');
  const { makeProjectUxGoalRouter } = await import('../../routes/project-ux-goal.ts');
  const { ConceptSheetJobs } = await import('../concept-sheet-jobs.ts');
  const { AppError } = await import('../errors.ts');
  const state = await initLocalDb(':memory:'); assert.equal(state.ok, true, state.error ?? undefined);
  const close = getLocalSqlite() as unknown as { close(): void };
  try {
    const identify = (userId: string): void => enableLocalAuth({ userId, displayName: null, role: 'user', projectKey: null });
    identify('author');
    await getDb().insert(projects).values([{ id: 'p', name: 'ひかりの庭', orgId: 'test', ownerUserId: 'author' },
      { id: 'other', name: 'Other', orgId: 'test', ownerUserId: 'author' }]);
    await getDb().insert(projectMembers).values([{ id: 'a', projectId: 'p', userId: 'author', role: 'owner' },
      { id: 'b', projectId: 'other', userId: 'author', role: 'owner' }, { id: 'c', projectId: 'p', userId: 'reader', role: 'viewer' }]);
    const seen: Array<{ catchcopy: string; images: number; previous: boolean; instructions: string }> = [];
    const jobs = new ConceptSheetJobs();
    const app = new Hono(); app.onError((e) => new Response(JSON.stringify({ error: e.message }), { status: e instanceof AppError ? e.status : 500 }));
    app.route('/projects/:pid/concept-sheets', makeConceptSheetRouter(async ({ material, images, previous, instructions }) => {
      seen.push({ catchcopy: material.catchcopy.text, images: images.length, previous: previous !== null, instructions });
      const catchcopy = material.catchcopy.text || 'AIが考えた文言';
      const { checkConceptSheetOutput } = await import('../concept-sheet-design-check.ts');
      const checked = checkConceptSheetOutput(output({ catchcopy, html: sheetHtml(catchcopy) }), { imageLabels: images.map((i) => i.image.label), catchcopy: material.catchcopy.text });
      if (checked.kind !== 'ok') throw new Error('fixture must pass');
      return { design: checked.design, skillDigest: 'skill', model: 'gpt-6-astra' };
    }, jobs));
    app.route('/projects/:pid/ux-goal', makeProjectUxGoalRouter());
    const request = (path: string, method: string, body?: unknown) => app.request(path,
      { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const settle = async (): Promise<void> => {
      for (let i = 0; i < 100 && jobs.get('p')?.state === 'running'; i += 1) await new Promise((r) => setTimeout(r, 5));
    };
    const goal = async () => (await (await app.request('/projects/p/ux-goal')).json() as {
      definition: { catchcopy: string; catchcopyOrigin: string; story: string; emotions: string; revision: number } }).definition;
    const images = [{ label: LABEL, dataUrl: PNG }];
    const id = randomUUID();

    // UX/ゴールが空のうちは作らない。
    assert.equal((await request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 0, images })).status, 422);
    // PF-GOAL-W2: story / emotions は保存でき、省略した PUT では消えない。
    assert.equal((await request('/projects/p/ux-goal', 'PUT', { experience: '光を集める', design: '集めた光で花が咲く', goal: '庭が育つ',
      story: '出会う → 集める → 咲かせる', emotions: 'うれしい / 待ち遠しい', expectedRevision: 0 })).status, 200);
    assert.equal((await request('/projects/p/ux-goal', 'PUT', { experience: '光を集める', design: '集めた光で花が咲く', goal: '庭が育つ', expectedRevision: 1 })).status, 200);
    let g = await goal();
    assert.equal(g.story, '出会う → 集める → 咲かせる'); assert.equal(g.emotions, 'うれしい / 待ち遠しい'); assert.equal(g.revision, 2);
    assert.deepEqual([g.catchcopy, g.catchcopyOrigin], ['', '']);

    // PF-GOAL-W3: キャッチコピーが空なら Astra の案を載せ、UX/ゴールへも AI案 として入れる。
    assert.equal((await request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 0, images })).status, 202);
    await settle();
    g = await goal();
    assert.deepEqual([g.catchcopy, g.catchcopyOrigin, g.revision], ['AIが考えた文言', 'ai', 3]);
    const read = async (sheetId = id): Promise<ConceptSheetRecord> =>
      (await (await app.request(`/projects/p/concept-sheets/${sheetId}`)).json() as { sheet: ConceptSheetRecord }).sheet;
    let sheet = await read();
    assert.equal(sheet.design.catchcopy, 'AIが考えた文言'); assert.equal(sheet.freshness, 'current'); assert.equal(sheet.images[0]?.label, LABEL);

    // 他の欄だけ直しても AI案 のまま。文言を直すと人の文言になる。
    assert.equal((await request('/projects/p/ux-goal', 'PUT', { experience: '光を集める', design: '集めた光で花が咲く', goal: '庭が育つ',
      catchcopy: 'AIが考えた文言', expectedRevision: 3 })).status, 200);
    assert.equal((await goal()).catchcopyOrigin, 'ai');
    assert.equal((await request('/projects/p/ux-goal', 'PUT', { experience: '光を集める', design: '集めた光で花が咲く', goal: '庭が育つ',
      catchcopy: COPY, expectedRevision: 4 })).status, 200);
    g = await goal(); assert.deepEqual([g.catchcopy, g.catchcopyOrigin], [COPY, 'human']);
    sheet = await read(); assert.equal(sheet.freshness, 'outdated');

    // 作り直しは保存済みの候補と前回の紙面を使い、人の文言をそのまま載せる。
    assert.equal((await request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 0, images })).status, 409);
    assert.equal((await request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 1, images: 'keep', instructions: '色を落ち着かせる' })).status, 202);
    await settle();
    sheet = await read();
    assert.equal(sheet.design.catchcopy, COPY); assert.equal(sheet.revision, 2); assert.equal(sheet.freshness, 'current');
    assert.deepEqual(seen.at(-1), { catchcopy: COPY, images: 1, previous: true, instructions: '色を落ち着かせる' });
    assert.equal((await goal()).catchcopyOrigin, 'human', '人の文言は上書きしない');

    const list = await (await app.request('/projects/p/concept-sheets')).json() as { items: Array<{ id: string; catchcopy: string; sceneLabel: string }> };
    assert.deepEqual(list.items.map((i) => [i.id, i.catchcopy, i.sceneLabel]), [[id, COPY, LABEL]]);
    assert.equal((await request('/projects/other/concept-sheets/' + id, 'GET')).status, 404);
    assert.deepEqual(await (await app.request('/projects/p/concept-sheets/generation')).json(), { job: null });

    identify('reader');
    assert.equal((await request('/projects/p/concept-sheets/generate', 'POST', { id: randomUUID(), expectedRevision: 0, images })).status, 403);
    assert.equal((await app.request('/projects/p/concept-sheets')).status, 200);
    identify('author');

    await getDb().update(projects).set({ uxGoal: '変わった' }).where(eq(projects.id, 'p'));
    assert.equal((await read()).freshness, 'outdated');
    assert.equal((await request(`/projects/p/concept-sheets/${id}?expectedRevision=1`, 'DELETE')).status, 409);
    assert.equal((await request(`/projects/p/concept-sheets/${id}?expectedRevision=2`, 'DELETE')).status, 200);
    assert.equal((await app.request(`/projects/p/concept-sheets/${id}`)).status, 404);
  } finally { close.close(); }
});
