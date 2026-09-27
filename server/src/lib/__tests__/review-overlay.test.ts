import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewOverlayTela } from '../../../../shared/review-overlay-tela.ts';
import type { ReviewOverlaySnapshot } from '../../../../shared/review-overlay.ts';

const snapshot = (): ReviewOverlaySnapshot => ({ projectId: 'p', teamId: 'a', implementation: { state: 'unavailable', message: 'Actio 未設定', items: [] }, projectName: '庭', scene: { id: 'scene', name: '庭',
  canvas: { revision: 2, frames: [{ id: 'base', name: '庭', description: '', states: [], x: 0, y: 0, width: 1280, height: 720,
    viewport: { width: 1280, height: 720 } }], elements: [], transitions: [] } }, specs: [], scenarios: [],
  acceptance: { specVersion: '1.2.3', latestRun: null, results: { total: 0, passed: 0, failed: 0, blocked: 0, pending: 0 } } });

test('native overlay does not convert missing test data into a pass', () => {
  const view = reviewOverlayTela(snapshot());
  assert.match(view, /テスト: 未実施/);
  const tested = snapshot();
  tested.acceptance.latestRun = { id: 'run', status: 'failed', startedAt: '2026-09-27T00:00:00Z', version: null };
  assert.match(reviewOverlayTela(tested), /テスト対象仕様版: 不明/);
  assert.match(reviewOverlayTela(tested), /failed/);
});

test('long specs remain foldable without dropping the final text; unknown frames fail explicitly', () => {
  const data = snapshot();
  data.specs = [{ id: 's', code: 'S-1', title: '長い仕様', status: 'draft', version: 1, description: '光の指示\n'.repeat(40) + '最後の条件' }];
  const view = reviewOverlayTela(data);
  assert.match(view, /pf-review-heading\/spec\/spec-s/);
  assert.equal(view.split('scene ').length - 1, 2); // Long text does not consume scenario groups.
  assert.match(view, /最後の条件/);
  assert.throws(() => reviewOverlayTela(data, 'missing'), /指定したシーン画面/);
});
