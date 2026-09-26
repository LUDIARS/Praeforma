// ビジュアル素材 (spec/feature/project-visuals.md) の確認。題材は架空の企画「ひかりの庭」。
import { openTestApp, tinyPng } from './concept-sheet-fixtures.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectVisual, ProjectVisualWithImage } from '../../../../shared/project-visual.ts';

const visual = (over: Partial<ProjectVisual>): ProjectVisual => ({
  id: 'v', kind: 'screenshot', label: '画面', note: '', featured: false, mimeType: 'image/png', byteSize: 12, digest: 'd',
  revision: 1, createdAt: '2026-09-26T00:00:00.000Z', updatedAt: '2026-09-26T00:00:00.000Z', ...over,
});

test('default candidates are key visuals, then featured ones, then concept art (newest first, up to 6)', async () => {
  const { defaultCandidateVisualIds } = await import('../../../../shared/project-visual.ts');
  const at = (minute: number): string => `2026-09-26T00:${String(minute).padStart(2, '0')}:00.000Z`;
  const visuals = [
    visual({ id: 'shot', kind: 'screenshot', createdAt: at(1) }),
    visual({ id: 'shot-best', kind: 'screenshot', featured: true, createdAt: at(2) }),
    visual({ id: 'art-old', kind: 'concept_art', createdAt: at(3) }),
    visual({ id: 'art-new', kind: 'concept_art', createdAt: at(4) }),
    visual({ id: 'key', kind: 'key_visual', createdAt: at(5) }),
    visual({ id: 'art-best', kind: 'concept_art', featured: true, createdAt: at(6) }),
  ];
  assert.deepEqual(defaultCandidateVisualIds(visuals), ['key', 'art-best', 'shot-best', 'art-new', 'art-old']);
  assert.deepEqual(defaultCandidateVisualIds(visuals, 2), ['key', 'art-best']);
  assert.deepEqual(defaultCandidateVisualIds([visual({ id: 'plain' })]), [], '一押しでないスクリーンショットだけなら人が選ぶ');
});

test('visuals are registered per project, edited by revision and kept for versions when deleted', async () => {
  const { getLocalSqlite } = await import('../../db/connection.ts');
  const { makeProjectVisualRouter } = await import('../../routes/project-visuals.ts');
  const changes: string[] = [];
  const t = await openTestApp((app) => { app.route('/projects/:pid/visuals', makeProjectVisualRouter((pid) => changes.push(pid))); });
  try {
    const { request, json, identify } = t;
    const create = async (body: Record<string, unknown>): Promise<ProjectVisual> => {
      const res = await request('/projects/p/visuals', 'POST', body);
      assert.equal(res.status, 201, await res.clone().text());
      return (await res.json() as { visual: ProjectVisual }).visual;
    };

    // PF-VIS-1: 3 種類・名前・メモ・一押し。一覧は画像の中身を返さず、1 枚ずつ取ると data URL が付く。
    const key = await create({ kind: 'key_visual', label: 'ひかりの庭 キービジュアル', dataUrl: tinyPng(1) });
    const art = await create({ kind: 'concept_art', label: '夜の庭', note: '光が集まる前の静けさ', dataUrl: tinyPng(2) });
    const shot = await create({ kind: 'screenshot', label: '花が咲く瞬間', featured: true, dataUrl: tinyPng(3) });
    assert.deepEqual([key.featured, art.note, shot.featured, shot.revision, shot.mimeType], [false, '光が集まる前の静けさ', true, 1, 'image/png']);
    const list = await json<{ canEdit: boolean; max: number; items: Array<ProjectVisual & { dataUrl?: string }> }>('/projects/p/visuals');
    assert.deepEqual([list.canEdit, list.max], [true, 30]);
    assert.deepEqual(list.items.map((v) => v.id), [key.id, art.id, shot.id], '登録した順');
    assert.equal(list.items.some((v) => 'dataUrl' in v), false);
    const one = await json<{ visual: ProjectVisualWithImage }>(`/projects/p/visuals/${shot.id}`);
    assert.equal(one.visual.dataUrl, tinyPng(3));
    assert.deepEqual(changes, [], '登録だけでは企画概要書の材料は変わらない');

    // PF-VIS-2: 名前は 1 行、画像は PNG / JPEG / WebP で中身と種類が合うもの、4MB まで。
    assert.equal((await request('/projects/p/visuals', 'POST', { kind: 'screenshot', label: '二行の\n名前', dataUrl: tinyPng(4) })).status, 400);
    assert.equal((await request('/projects/p/visuals', 'POST', { kind: 'poster', label: 'x', dataUrl: tinyPng(4) })).status, 400);
    assert.equal((await request('/projects/p/visuals', 'POST', { kind: 'screenshot', label: 'x', dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' })).status, 400);
    assert.equal((await request('/projects/p/visuals', 'POST', { kind: 'screenshot', label: 'x', dataUrl: tinyPng(4).replace('image/png', 'image/webp') })).status, 400);
    const huge = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(4 * 1024 * 1024)]).toString('base64')}`;
    assert.equal((await request('/projects/p/visuals', 'POST', { kind: 'screenshot', label: 'x', dataUrl: huge })).status, 413);

    // PF-VIS-3: 版一致で直す。古い版は 409、別プロジェクトからは 404、閲覧者は 403。変えたら自動更新へ知らせる。
    const edited = await request(`/projects/p/visuals/${art.id}`, 'PUT', { kind: 'concept_art', label: '夜の庭（光の前）', note: '', featured: true, expectedRevision: 1 });
    assert.equal(edited.status, 200);
    assert.deepEqual(((await edited.json()) as { visual: ProjectVisual }).visual.revision, 2);
    assert.equal((await request(`/projects/p/visuals/${art.id}`, 'PUT', { kind: 'concept_art', label: '上書き', note: '', featured: false, expectedRevision: 1 })).status, 409);
    assert.equal((await request(`/projects/other/visuals/${art.id}`, 'PUT', { kind: 'concept_art', label: '別', note: '', featured: false, expectedRevision: 2 })).status, 404);
    assert.equal((await request(`/projects/other/visuals/${art.id}`, 'GET')).status, 404);
    assert.deepEqual(changes, ['p']);
    identify('reader');
    assert.equal((await request('/projects/p/visuals', 'GET')).status, 200);
    assert.equal((await request('/projects/p/visuals', 'POST', { kind: 'screenshot', label: 'x', dataUrl: tinyPng(5) })).status, 403);
    assert.equal((await request(`/projects/p/visuals/${art.id}?expectedRevision=2`, 'DELETE')).status, 403);
    identify('author');

    // PF-VIS-4: どの版も使っていなければ行ごと消す。版が使っていれば削除済みの印だけを付けて画像を残す。
    const rows = (): Array<{ id: string; deleted: number | null }> => (getLocalSqlite()!.prepare(
      'SELECT id, deleted_at AS deleted FROM project_visuals ORDER BY created_at, id').all() as Array<{ id: string; deleted: number | null }>);
    assert.equal((await request(`/projects/p/visuals/${key.id}?expectedRevision=2`, 'DELETE')).status, 409);
    assert.equal((await request(`/projects/p/visuals/${key.id}?expectedRevision=1`, 'DELETE')).status, 200);
    assert.equal(rows().some((r) => r.id === key.id), false, '使われていない行は消える');
    getLocalSqlite()!.prepare(`INSERT INTO concept_sheet_versions (sheet_id, rv, project_id, payload, visual_refs, kind, created_by, created_at)
      VALUES ('s', 1, 'p', '{}', ?, 'create', 'author', 0)`).run(JSON.stringify([{ visualId: shot.id, digest: shot.digest, kind: 'screenshot', label: shot.label, note: '' }]));
    assert.equal((await request(`/projects/p/visuals/${shot.id}?expectedRevision=1`, 'DELETE')).status, 200);
    assert.ok(rows().find((r) => r.id === shot.id)?.deleted, '版が使う行は印を付けて残す');
    assert.deepEqual((await json<{ items: ProjectVisual[] }>('/projects/p/visuals')).items.map((v) => v.id), [art.id]);
    assert.equal((await request(`/projects/p/visuals/${shot.id}`, 'GET')).status, 404, '削除したものは一覧・取得に出ない');
    assert.equal((await request(`/projects/p/visuals/${shot.id}?expectedRevision=2`, 'DELETE')).status, 404);
    assert.deepEqual(changes, ['p', 'p', 'p']);
  } finally { t.close(); }
});

test('a project keeps at most 30 visuals', async () => {
  const { makeProjectVisualRouter } = await import('../../routes/project-visuals.ts');
  const t = await openTestApp((app) => { app.route('/projects/:pid/visuals', makeProjectVisualRouter()); });
  try {
    for (let i = 0; i < 30; i += 1) {
      assert.equal((await t.request('/projects/p/visuals', 'POST', { kind: 'screenshot', label: `画面${i}`, dataUrl: tinyPng(i) })).status, 201);
    }
    const over = await t.request('/projects/p/visuals', 'POST', { kind: 'screenshot', label: '31 枚目', dataUrl: tinyPng(31) });
    assert.equal(over.status, 422);
    assert.equal((await over.json() as { error: string }).error, 'visual_limit_reached');
    assert.equal((await t.request('/projects/other/visuals', 'POST', { kind: 'screenshot', label: '別の企画', dataUrl: tinyPng(1) })).status, 201,
      '上限はプロジェクトごと');
  } finally { t.close(); }
});
