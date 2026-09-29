// 全プロジェクトの企画概要書の一覧 (PF-CS-8) の並べ方の確認。
// 題材は架空の企画。実在の企画名や非公開の企画の内容を書かない。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangeConceptSheetIndex } from '../../../../shared/concept-sheet-index.ts';
import type { ConceptSheetSummary } from '../../../../shared/concept-sheet.ts';

function sheet(id: string, title: string, updatedAt: string): ConceptSheetSummary {
  return { id, title, catchcopy: `${title}のコピー`, concept: '', sceneLabel: '庭', updatedAt, freshness: 'current', rv: 1, autoUpdate: true };
}

const garden = { id: 'p-garden', name: 'ひかりの庭' };
const tower = { id: 'p-tower', name: 'くもの塔' };

test('全プロジェクトの紙面を 1 つの並びにし、更新が新しい順に並べる', () => {
  const { entries, failures } = arrangeConceptSheetIndex([
    { project: garden, items: [sheet('g1', '庭', '2026-09-20T00:00:00.000Z'), sheet('g2', '温室', '2026-09-28T00:00:00.000Z')], error: null },
    { project: tower, items: [sheet('t1', '塔', '2026-09-25T00:00:00.000Z')], error: null },
  ]);
  assert.deepEqual(entries.map((e) => [e.project.id, e.sheet.id]), [['p-garden', 'g2'], ['p-tower', 't1'], ['p-garden', 'g1']]);
  assert.deepEqual(failures, []);
});

test('同じ時刻はプロジェクト名、企画名の順で決まった並びにする', () => {
  const at = '2026-09-28T00:00:00.000Z';
  const { entries } = arrangeConceptSheetIndex([
    { project: garden, items: [sheet('g2', 'ゆり', at), sheet('g1', 'あさがお', at)], error: null },
    { project: tower, items: [sheet('t1', '塔', at)], error: null },
  ]);
  assert.deepEqual(entries.map((e) => e.sheet.id), ['t1', 'g1', 'g2']);
});

test('一覧を取れなかったプロジェクトは失敗として分け、ほかの紙面は並べる', () => {
  const { entries, failures } = arrangeConceptSheetIndex([
    { project: garden, items: [], error: '権限がありません' },
    { project: tower, items: [sheet('t1', '塔', '2026-09-25T00:00:00.000Z')], error: null },
  ]);
  assert.deepEqual(entries.map((e) => e.sheet.id), ['t1']);
  assert.deepEqual(failures, [{ project: garden, error: '権限がありません' }]);
});

test('紙面の無いプロジェクトは並びにも失敗にも出さない', () => {
  const result = arrangeConceptSheetIndex([{ project: garden, items: [], error: null }]);
  assert.deepEqual(result, { entries: [], failures: [] });
});
