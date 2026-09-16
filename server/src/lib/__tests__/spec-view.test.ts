import { test } from 'node:test';
import assert from 'node:assert/strict';
import { specViewDocument, specViewWidth, type SpecViewSpec } from '../../../../shared/spec-view.ts';
import { telaSpecView, TELA_SPEC_VIEW_MAX_CARDS } from '../../../../shared/tela-spec-view-export.ts';

const spec = (over: Partial<SpecViewSpec>): SpecViewSpec =>
  ({ code: 'TL-A', title: 'A', status: 'draft', category: 'behavior', priority: 'must', version: 1, ...over });

// Tela の契約テスト (tests/spec_view_test.cpp) と同じバイト列。
const specs: SpecViewSpec[] = [
  spec({ code: 'TL-A', title: 'Overlay "core"', status: 'draft', version: 2 }),
  spec({ code: 'TL-B', title: 'Bridge\\IPC', status: 'approved', category: 'data', priority: 'should' }),
];

test('PF-SPEC-VIEW groups specs on the chosen axis and lays them out deterministically', () => {
  const document = specViewDocument('Tela', '0.0.3', specs, 'status');
  assert.equal(document.width, specViewWidth());
  assert.deepEqual(document.groups.map(group => group.id), ['draft', 'approved']);
  assert.deepEqual(document.cards.map(card => [card.groupId, card.code, card.x, card.y]), [
    ['draft', 'TL-A', 24, 56],
    ['approved', 'TL-B', 24, 212],
  ]);
  // 空のグループは出さず、軸に無い値は「その他」へ落とす。
  const other = specViewDocument('Tela', '0.0.3', [spec({ status: 'unknown-state' })], 'status');
  assert.deepEqual(other.groups.map(group => group.id), ['other']);
  const byCategory = specViewDocument('Tela', '0.0.3', specs, 'category');
  assert.deepEqual(byCategory.groups.map(group => group.id), ['behavior', 'data']);
});

test('PF-SPEC-VIEW exports TELA_SPEC_VIEW 1 with escaped fields and rejects overflow', () => {
  const text = telaSpecView(specViewDocument('Tela', '0.0.3', specs, 'status'));
  assert.deepEqual(text.split('\n'), [
    'TELA_SPEC_VIEW 1',
    'view "Tela" "0.0.3" 1220 332',
    'group "draft" "下書き" 1',
    'group "approved" "確定" 1',
    'card "draft" "TL-A" "Overlay \\"core\\"" "draft" 2 24 56 380 96',
    'card "approved" "TL-B" "Bridge\\\\IPC" "approved" 1 24 212 380 96',
    '',
  ]);
  // 非表示は Tela 側の切り替えの初期値として 0 で出る。
  const hidden = telaSpecView(specViewDocument('Tela', '0.0.3', specs, 'status', new Set(['approved'])));
  assert.equal(hidden.includes('group "approved" "確定" 0'), true);

  assert.throws(() => telaSpecView(specViewDocument('Tela', '0.0.3', [], 'status')));
  const many = Array.from({ length: TELA_SPEC_VIEW_MAX_CARDS + 1 }, (_, index) => spec({ code: `TL-${index}` }));
  assert.throws(() => telaSpecView(specViewDocument('Tela', '0.0.3', many, 'status')));
});
