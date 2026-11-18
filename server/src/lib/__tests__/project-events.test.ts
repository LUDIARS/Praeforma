// ダッシュボードの最近の出来事 (純関数) — spec/feature/project-dashboard.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeProjectEvents, parseEventLimit, toIso } from '../project-events.ts';
import { AppError } from '../errors.ts';

test('toIso: SQLite の ms 整数・数字文字列・ISO・Date を揃え、読めない値は null', () => {
  const iso = '2026-11-19T01:02:03.000Z';
  const ms = Date.parse(iso);
  assert.equal(toIso(ms), iso);
  assert.equal(toIso(String(ms)), iso);
  assert.equal(toIso(iso), iso);
  assert.equal(toIso(new Date(ms)), iso);
  assert.equal(toIso('not a date'), null);
  assert.equal(toIso(null), null);
});

test('mergeProjectEvents: 3 種類を新しい順に並べ、limit で切る', () => {
  const items = mergeProjectEvents({
    fragments: [{ id: 'F1', content: '  ボタンを\n大きく  ', source: 'cc-skill', created_by: 'u1', created_at: Date.parse('2026-11-19T03:00:00Z') }],
    versions: [{ id: 'V1', version: '1.2.0', kind: 'reconstruction', created_at: '2026-11-19T02:00:00.000Z' },
      { id: 'V0', version: '1.1.1', kind: 'release', created_at: '2026-11-18T00:00:00.000Z' }],
    audits: [{ id: 7, action: 'scene.save', target_kind: 'layout', target_id: 'L1', actor_display_name: 'neco', actor_user_id: 'u1', created_at: new Date('2026-11-19T04:00:00Z') }],
    limit: 3,
  });
  assert.deepEqual(items.map((e) => [e.kind, e.title]), [['scene', 'シーンを編集'], ['fragment', '断片を追加'], ['systematize', '断片を体系化']]);
  assert.equal(items[1]!.detail, 'ボタンを 大きく');
  assert.equal(items[1]!.actor, 'cc-skill');
  assert.deepEqual(items[0]!.target, { kind: 'layout', id: 'L1' });
  assert.equal(items[2]!.detail, 'v1.2.0');
});

test('mergeProjectEvents: 対象外の操作・時刻の無い行は出さず、長い断片は省略する', () => {
  const items = mergeProjectEvents({
    fragments: [{ id: 'F1', content: 'あ'.repeat(200), source: '', created_by: 'u1', created_at: '2026-11-19T00:00:00Z' },
      { id: 'F2', content: 'x', source: 's', created_by: 'u', created_at: null }],
    versions: [],
    audits: [{ id: 1, action: 'project_constraint.update', target_kind: 'project', target_id: 'P', actor_display_name: null, actor_user_id: 'u', created_at: '2026-11-19T00:00:00Z' },
      { id: 2, action: 'spec.update', target_kind: 'unknown', target_id: 'X', actor_display_name: null, actor_user_id: 'u9', created_at: '2026-11-18T00:00:00Z' }],
    limit: 10,
  });
  assert.equal(items.length, 2);
  assert.equal(items[0]!.detail!.length, 81);
  assert.equal(items[0]!.actor, 'u1');
  assert.equal(items[1]!.target, null);
  assert.equal(items[1]!.actor, 'u9');
});

test('parseEventLimit: 既定 30、上限 100、不正値は invalid_limit', () => {
  assert.equal(parseEventLimit(undefined), 30);
  assert.equal(parseEventLimit('500'), 100);
  assert.equal(parseEventLimit('5'), 5);
  for (const bad of ['0', '-1', '1.5', 'x']) assert.throws(() => parseEventLimit(bad), (e: unknown) => e instanceof AppError && e.message === 'invalid_limit');
});
