// 企画概要書の版 (PF-CS-10)・材料の仕様と鮮度 (PF-CS-7 / PF-CS-11)・候補のビジュアル (PF-CS-12) の確認。
// 題材は架空の企画「ひかりの庭」。実在の企画名や非公開の企画の内容を書かない。
import { COPY, openTestApp, settle, sheetHtml, tinyPng, type TestApp } from './concept-sheet-fixtures.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ConceptSheetRecord, ConceptSheetVersionSummary } from '../../../../shared/concept-sheet.ts';
import type { ProjectVisual } from '../../../../shared/project-visual.ts';
import type { ConceptSheetWriter } from '../concept-sheet-writer.ts';

const UX = { experience: '光を集める', design: '集めた光で花が咲く', goal: '庭が育つ', catchcopy: COPY, expectedRevision: 0 };

/** 候補の先頭を主役にして、キャッチコピーとその名前を載せた紙面を返す書き手。受け取った候補の名前を記録する。 */
function fakeWriter(seen: string[][]): ConceptSheetWriter {
  return async ({ material, images }) => {
    const label = images[0]!.image.label;
    seen.push(images.map((i) => i.image.label));
    return { skillDigest: 'skill', model: 'gpt-6-astra', design: { title: 'ひかりの庭', catchcopy: material.catchcopy.text,
      concept: '光を集めて花を咲かせる。', scene: { index: 0, label, reason: '光が集まる' }, sections: ['ポイント'],
      html: sheetHtml(material.catchcopy.text, label) } };
  };
}

async function openSheetsApp(seen: string[][], changes: string[] = []): Promise<TestApp & { waitJobs(): Promise<void> }> {
  const { makeConceptSheetRouter } = await import('../../routes/concept-sheets.ts');
  const { makeProjectUxGoalRouter } = await import('../../routes/project-ux-goal.ts');
  const { makeProjectVisualRouter } = await import('../../routes/project-visuals.ts');
  const { makeSpecRouter } = await import('../../routes/specs.ts');
  const { ConceptSheetJobs } = await import('../concept-sheet-jobs.ts');
  const jobs = new ConceptSheetJobs();
  const notify = (pid: string): void => { changes.push(pid); };
  const t = await openTestApp((app) => {
    app.route('/projects/:pid/concept-sheets', makeConceptSheetRouter(fakeWriter(seen), jobs,
      { scheduledAt: () => null, notifyChange: notify }));
    app.route('/projects/:pid/ux-goal', makeProjectUxGoalRouter(notify));
    app.route('/projects/:pid/visuals', makeProjectVisualRouter(notify));
    app.route('/projects/:pid/specs', makeSpecRouter(notify));
  });
  const waitJobs = async (): Promise<void> => {
    for (let i = 0; i < 100 && jobs.get('p')?.state === 'running'; i += 1) await new Promise((r) => setTimeout(r, 5));
    await settle();
    assert.equal(jobs.get('p'), null, JSON.stringify(jobs.get('p')));
  };
  return { ...t, waitJobs };
}

async function addVisual(t: TestApp, body: Record<string, unknown>): Promise<ProjectVisual> {
  const res = await t.request('/projects/p/visuals', 'POST', body);
  assert.equal(res.status, 201);
  return (await res.json() as { visual: ProjectVisual }).visual;
}

test('existing sheets become rv1 once, and regenerating one moves its images into visuals', async () => {
  const { getLocalSqlite } = await import('../../db/connection.ts');
  const { SQLITE_BACKFILLS } = await import('../../db/sqlite-schema.ts');
  const seen: string[][] = [];
  const t = await openSheetsApp(seen);
  try {
    assert.equal((await t.request('/projects/p/ux-goal', 'PUT', UX)).status, 200);
    // migration 021 より前の形: 画像を行の中に持ち、版の表が無かった行。
    const id = randomUUID();
    const design = { title: 'ひかりの庭', catchcopy: COPY, concept: '光を集めて花を咲かせる。', scene: { index: 0, label: '前の画面', reason: '' },
      sections: ['ポイント'], html: sheetHtml(COPY, '前の画面') };
    const legacyImage = { label: '前の画面', dataUrl: tinyPng(7), mimeType: 'image/png', digest: 'legacy' };
    const sqlite = getLocalSqlite()!;
    sqlite.prepare('INSERT INTO concept_sheets (id, project_id, payload, revision, updated_at) VALUES (?, ?, ?, 3, ?)').run(id, 'p',
      JSON.stringify({ design, images: [legacyImage], source: { uxGoalRevision: 1, uxDigest: 'old', imagesDigest: 'i', skillDigest: 's', model: 'gpt-6-astra', instructions: '' } }),
      Date.parse('2026-09-26T00:00:00Z'));
    for (const backfill of SQLITE_BACKFILLS) sqlite.prepare(backfill).run();
    for (const backfill of SQLITE_BACKFILLS) sqlite.prepare(backfill).run();
    const versions = sqlite.prepare('SELECT rv, kind FROM concept_sheet_versions WHERE sheet_id = ?').all(id);
    assert.deepEqual(versions, [{ rv: 1, kind: 'migrated' }], '2 回流しても 1 つだけ');

    let view = await t.json<{ sheet: ConceptSheetRecord; versions: ConceptSheetVersionSummary[] }>(`/projects/p/concept-sheets/${id}`);
    assert.deepEqual([view.sheet.rv, view.sheet.latestRv, view.sheet.kind, view.sheet.revision, view.sheet.autoUpdate], [1, 1, 'migrated', 3, true]);
    assert.equal(view.sheet.images[0]?.dataUrl, tinyPng(7), '行の版を画像ごと引き継ぐ');
    assert.equal(view.sheet.freshness, 'outdated', '仕様を材料にする前の版は古い');

    // 「前回の候補を使う」: 行の中の画像をスクリーンショットとしてビジュアルへ移し、それを候補にして rv2 を作る。
    assert.equal((await t.request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 3, visualIds: 'keep' })).status, 202);
    await t.waitJobs();
    const visuals = (await t.json<{ items: ProjectVisual[] }>('/projects/p/visuals')).items;
    assert.deepEqual(visuals.map((v) => [v.kind, v.label]), [['screenshot', '前の画面']]);
    view = await t.json(`/projects/p/concept-sheets/${id}`);
    assert.deepEqual([view.sheet.rv, view.sheet.kind, view.sheet.freshness], [2, 'regenerate', 'current']);
    assert.deepEqual(view.sheet.visuals.map((v) => v.visualId), [visuals[0]!.id]);
    assert.deepEqual(view.versions.map((v) => v.rv), [2, 1]);
    const rv1 = await t.json<{ sheet: ConceptSheetRecord }>(`/projects/p/concept-sheets/${id}/versions/1`);
    assert.equal(rv1.sheet.images[0]?.dataUrl, tinyPng(7));

    // もう一度作り直しても二重には移さない。
    assert.equal((await t.request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 4, visualIds: 'keep' })).status, 202);
    await t.waitJobs();
    assert.equal((await t.json<{ items: ProjectVisual[] }>('/projects/p/visuals')).items.length, 1);
    assert.deepEqual(seen, [['前の画面'], ['前の画面']]);
  } finally { t.close(); }
});

test('old versions keep the images they used after visuals are deleted, and changes to used visuals make the sheet outdated', async () => {
  const { getLocalSqlite } = await import('../../db/connection.ts');
  const seen: string[][] = [];
  const t = await openSheetsApp(seen);
  try {
    assert.equal((await t.request('/projects/p/ux-goal', 'PUT', UX)).status, 200);
    const first = await addVisual(t, { kind: 'screenshot', label: '最初の庭', dataUrl: tinyPng(1) });
    const second = await addVisual(t, { kind: 'key_visual', label: '咲いた庭', dataUrl: tinyPng(2) });
    const unused = await addVisual(t, { kind: 'concept_art', label: '使わない絵', dataUrl: tinyPng(3) });
    const id = randomUUID();
    assert.equal((await t.request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 0, visualIds: [first.id] })).status, 202);
    await t.waitJobs();
    assert.equal((await t.request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 1, visualIds: [second.id] })).status, 202);
    await t.waitJobs();

    // rv1 が使った画像は、ビジュアルを消しても rv1 の紙面から消えない。
    assert.equal((await t.request(`/projects/p/visuals/${first.id}?expectedRevision=1`, 'DELETE')).status, 200);
    const rv1 = await t.json<{ sheet: ConceptSheetRecord }>(`/projects/p/concept-sheets/${id}/versions/1`);
    assert.equal(rv1.sheet.images[0]?.dataUrl, tinyPng(1));
    let latest = await t.json<{ sheet: ConceptSheetRecord }>(`/projects/p/concept-sheets/${id}`);
    assert.equal(latest.sheet.freshness, 'current', '最新版が使っていないビジュアルの削除では古くならない');

    // 最新版が使うビジュアルの名前を変えると古くなる。一押しを付けるだけなら古くならない。
    assert.equal((await t.request(`/projects/p/visuals/${second.id}`, 'PUT', { kind: 'key_visual', label: '咲いた庭', note: '', featured: true, expectedRevision: 1 })).status, 200);
    latest = await t.json(`/projects/p/concept-sheets/${id}`);
    assert.equal(latest.sheet.freshness, 'current');
    assert.equal((await t.request(`/projects/p/visuals/${second.id}`, 'PUT', { kind: 'key_visual', label: '満開の庭', note: '', featured: true, expectedRevision: 2 })).status, 200);
    latest = await t.json(`/projects/p/concept-sheets/${id}`);
    assert.equal(latest.sheet.freshness, 'outdated');
    assert.equal(latest.sheet.visuals[0]?.label, '咲いた庭', '版は作ったときの名前を持つ');

    // 使っていないビジュアルは行ごと消え、企画概要書を消すと、どの版も使わなくなった削除済みの行も片付く。
    assert.equal((await t.request(`/projects/p/visuals/${unused.id}?expectedRevision=1`, 'DELETE')).status, 200);
    const ids = (): string[] => (getLocalSqlite()!.prepare('SELECT id FROM project_visuals ORDER BY id').all() as Array<{ id: string }>).map((r) => r.id);
    assert.deepEqual(ids(), [first.id, second.id].sort());
    assert.equal((await t.request(`/projects/p/concept-sheets/${id}?expectedRevision=2`, 'DELETE')).status, 200);
    assert.deepEqual(ids(), [second.id], '削除済みの印の行 (最初の庭) は片付き、削除していない行は残る');
  } finally { t.close(); }
});

test('specs are material by title, category and status only, and their changes make sheets outdated', async () => {
  const { getDb } = await import('../../db/connection.ts');
  const { specs } = await import('../../db/schema/spec.ts');
  const { readConceptSheetMaterial } = await import('../concept-sheet-sources.ts');
  const changes: string[] = [];
  const t = await openSheetsApp([], changes);
  try {
    assert.equal((await t.request('/projects/p/ux-goal', 'PUT', UX)).status, 200);
    const shot = await addVisual(t, { kind: 'screenshot', label: '庭の画面', dataUrl: tinyPng(1) });
    const res = await t.request('/projects/p/specs', 'POST', { code: 'GARDEN-1', title: '光を集めると花が咲く', description: '本文は材料に入れない',
      category: 'behavior', status: 'draft' });
    assert.equal(res.status, 201);
    const spec = (await res.json() as { spec: { id: string; version: number } }).spec;
    let material = await readConceptSheetMaterial('p');
    assert.deepEqual(material.specs, [{ title: '光を集めると花が咲く', category: 'behavior', status: 'draft' }]);
    assert.doesNotMatch(JSON.stringify(material), /本文は材料に入れない/);
    const before = material.specDigest;

    const id = randomUUID();
    assert.equal((await t.request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 0, visualIds: [shot.id] })).status, 202);
    await t.waitJobs();
    assert.equal((await t.json<{ sheet: ConceptSheetRecord }>(`/projects/p/concept-sheets/${id}`)).sheet.freshness, 'current');

    // 本文だけの変更は材料を変えない。状態の変更は変える (「今できること / これから」の判断に使う)。
    assert.equal((await t.request(`/projects/p/specs/${spec.id}`, 'PATCH', { prev_version: spec.version, description: '書き直した本文' })).status, 200);
    material = await readConceptSheetMaterial('p');
    assert.equal(material.specDigest, before);
    assert.equal((await t.json<{ sheet: ConceptSheetRecord }>(`/projects/p/concept-sheets/${id}`)).sheet.freshness, 'current');
    assert.equal((await t.request(`/projects/p/specs/${spec.id}`, 'PATCH', { prev_version: spec.version + 1, status: 'approved' })).status, 200);
    assert.notEqual((await readConceptSheetMaterial('p')).specDigest, before);
    assert.equal((await t.json<{ sheet: ConceptSheetRecord }>(`/projects/p/concept-sheets/${id}`)).sheet.freshness, 'outdated');
    assert.equal((await t.request(`/projects/p/specs/${spec.id}`, 'DELETE')).status, 200);
    assert.deepEqual((await readConceptSheetMaterial('p')).specs, [], '削除した仕様は材料に入れない');
    assert.deepEqual(changes, ['p', 'p', 'p', 'p', 'p'], 'UX 保存・仕様の作成・更新 2 回・削除を自動更新へ知らせる');

    // 上限は 100 件 (コード順)。
    await getDb().insert(specs).values(Array.from({ length: 120 }, (_, i) => ({ id: `s${i}`, projectId: 'p',
      code: `BULK-${String(i).padStart(3, '0')}`, title: `仕様 ${i}`, createdBy: 'author' })));
    material = await readConceptSheetMaterial('p');
    assert.equal(material.specs.length, 100);
    assert.equal(material.specs[0]?.title, '仕様 0');
  } finally { t.close(); }
});

test('auto update is on by default and can be turned off per sheet', async () => {
  const { findOutdatedAutoSheets, findProjectsWithOutdatedAutoSheets } = await import('../concept-sheet-auto-targets.ts');
  const changes: string[] = [];
  const t = await openSheetsApp([], changes);
  try {
    assert.equal((await t.request('/projects/p/ux-goal', 'PUT', UX)).status, 200);
    const shot = await addVisual(t, { kind: 'screenshot', label: '庭の画面', dataUrl: tinyPng(1) });
    const id = randomUUID();
    assert.equal((await t.request('/projects/p/concept-sheets/generate', 'POST', { id, expectedRevision: 0, visualIds: [shot.id] })).status, 202);
    await t.waitJobs();
    assert.deepEqual(await findOutdatedAutoSheets('p'), [], '作った直後は古くない');
    assert.equal((await t.request('/projects/p/ux-goal', 'PUT', { ...UX, goal: '庭が季節ごとに育つ', expectedRevision: 1 })).status, 200);
    assert.deepEqual(await findOutdatedAutoSheets('p'), [id]);
    assert.deepEqual(await findProjectsWithOutdatedAutoSheets(), ['p']);

    changes.length = 0;
    assert.equal((await t.request(`/projects/p/concept-sheets/${id}/auto-update`, 'PUT', { enabled: false })).status, 200);
    assert.deepEqual(changes, [], 'OFF にしても予約しない');
    assert.deepEqual(await findOutdatedAutoSheets('p'), [], 'OFF のシートは自動更新しない');
    assert.deepEqual(await findProjectsWithOutdatedAutoSheets(), []);
    const list = await t.json<{ items: Array<{ id: string; autoUpdate: boolean; freshness: string; rv: number }> }>('/projects/p/concept-sheets');
    assert.deepEqual(list.items.map((i) => [i.id, i.autoUpdate, i.freshness, i.rv]), [[id, false, 'outdated', 1]]);
    const view = await t.json<{ sheet: ConceptSheetRecord }>(`/projects/p/concept-sheets/${id}`);
    assert.deepEqual([view.sheet.autoUpdate, view.sheet.revision], [false, 1], 'ON/OFF は紙面の版一致に触らない');

    assert.equal((await t.request(`/projects/p/concept-sheets/${id}/auto-update`, 'PUT', { enabled: true })).status, 200);
    assert.deepEqual(changes, ['p'], 'ON にしたら予約する');
    assert.deepEqual(await findOutdatedAutoSheets('p'), [id]);
    assert.equal((await t.request(`/projects/p/concept-sheets/${id}/auto-update`, 'PUT', { enabled: 'yes' })).status, 400);
    assert.equal((await t.request(`/projects/other/concept-sheets/${id}/auto-update`, 'PUT', { enabled: true })).status, 404);
  } finally { t.close(); }
});
