// 制約 (spec/feature/project-constraints.md) と UX の構成変更 (spec/feature/project-ux-goal.md PF-GOAL-W4) の確認。
// 題材は架空の企画「ひかりの庭」。実在の企画名や非公開の企画の内容を書かない。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import type { ProjectConstraint } from '../../../../shared/project-constraint.ts';

process.env.PRAEFORMA_LOCAL_MODE = '1';

test('constraints are kept per project, updated by revision, and planning ones bind the UX', async () => {
  const { initLocalDb, getDb, getLocalSqlite } = await import('../../db/connection.ts');
  const { projects, projectMembers } = await import('../../db/schema/project.ts');
  const { enableLocalAuth } = await import('../../middleware/require-auth.ts');
  const { makeProjectConstraintRouter } = await import('../../routes/project-constraints.ts');
  const { makeProjectUxGoalRouter } = await import('../../routes/project-ux-goal.ts');
  const { readConceptSheetMaterial } = await import('../concept-sheet-sources.ts');
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
    const app = new Hono(); app.onError((e) => new Response(JSON.stringify({ error: e.message }), { status: e instanceof AppError ? e.status : 500 }));
    app.route('/projects/:pid/constraints', makeProjectConstraintRouter());
    app.route('/projects/:pid/ux-goal', makeProjectUxGoalRouter());
    const request = (path: string, method: string, body?: unknown) => app.request(path,
      { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const created = async (body: unknown): Promise<ProjectConstraint> => {
      const res = await request('/projects/p/constraints', 'POST', body);
      assert.equal(res.status, 201);
      return (await res.json() as { constraint: ProjectConstraint }).constraint;
    };

    // PF-CON-1: 種類・見出し・説明を 1 件ずつ。見出しは 1 行。
    const tech = await created({ kind: 'technical', title: 'スマホのブラウザで動く', detail: '' });
    const plan = await created({ kind: 'planning', title: '1 回は 5 分で遊べる', detail: '通勤の合間に終わる長さ' });
    assert.equal((await request('/projects/p/constraints', 'POST', { kind: 'planning', title: '二行の\n見出し' })).status, 400);
    assert.equal((await request('/projects/p/constraints', 'POST', { kind: 'unknown', title: 'x' })).status, 400);
    const list = await (await app.request('/projects/p/constraints')).json() as { canEdit: boolean; items: ProjectConstraint[] };
    assert.equal(list.canEdit, true);
    assert.deepEqual(list.items.map((c) => c.kind), ['planning', 'technical'], '企画 → 技術 の順に並ぶ');

    // PF-CON-2: 版一致で更新・削除。古い版は 409、別プロジェクトからは 404。
    const upd = await request(`/projects/p/constraints/${plan.id}`, 'PUT',
      { kind: 'planning', title: '1 回は 3 分で遊べる', detail: '', expectedRevision: 1 });
    assert.equal(upd.status, 200);
    assert.equal((await upd.json() as { constraint: ProjectConstraint }).constraint.revision, 2);
    assert.equal((await request(`/projects/p/constraints/${plan.id}`, 'PUT',
      { kind: 'planning', title: '上書き', detail: '', expectedRevision: 1 })).status, 409);
    assert.equal((await request(`/projects/other/constraints/${plan.id}`, 'PUT',
      { kind: 'planning', title: '別プロジェクト', detail: '', expectedRevision: 2 })).status, 404);
    assert.equal((await request(`/projects/p/constraints/${tech.id}?expectedRevision=2`, 'DELETE')).status, 409);

    // 閲覧者は見られるが変えられない。
    identify('reader');
    assert.equal((await app.request('/projects/p/constraints')).status, 200);
    assert.equal((await request('/projects/p/constraints', 'POST', { kind: 'other', title: '期日' })).status, 403);
    identify('author');

    // PF-GOAL-W4: ターゲットユーザーを保存でき、目指す価値/コンセプト (キャッチコピー) は改行を受け付けない。
    assert.equal((await request('/projects/p/ux-goal', 'PUT', { experience: '', design: '', goal: '',
      catchcopy: '光を集めて、\n庭を咲かせよう', expectedRevision: 0 })).status, 400);
    assert.equal((await request('/projects/p/ux-goal', 'PUT', { experience: '', design: '', goal: '',
      catchcopy: '光を集めて、庭を咲かせよう', target: '庭づくりが好きな人', story: '見つける → 集める → 咲かせる', expectedRevision: 0 })).status, 200);
    const goal = await (await app.request('/projects/p/ux-goal')).json() as { definition: { target: string; catchcopy: string } };
    assert.deepEqual([goal.definition.target, goal.definition.catchcopy], ['庭づくりが好きな人', '光を集めて、庭を咲かせよう']);

    // 企画概要書の材料には企画の制約だけが入り、制約が変わると鮮度の値も変わる (PF-CS-7)。
    const before = await readConceptSheetMaterial('p');
    assert.deepEqual(before.planningConstraints, [{ title: '1 回は 3 分で遊べる', detail: '' }]);
    assert.equal(before.ux.target, '庭づくりが好きな人');
    await created({ kind: 'planning', title: '課金で有利にしない', detail: '' });
    assert.notEqual((await readConceptSheetMaterial('p')).digest, before.digest);
    await created({ kind: 'technical', title: 'オフラインでも遊べる', detail: '' });
    assert.equal((await readConceptSheetMaterial('p')).planningConstraints.length, 2, '技術の制約は材料に入れない');

    assert.equal((await request(`/projects/p/constraints/${tech.id}?expectedRevision=1`, 'DELETE')).status, 200);
    assert.equal((await request(`/projects/p/constraints/${tech.id}?expectedRevision=1`, 'DELETE')).status, 404);
  } finally { close.close(); }
});
