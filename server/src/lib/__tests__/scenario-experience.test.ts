import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScenarioSchema, updateScenarioSchema } from '../../routes/ux-design-contracts.ts';
import { scenarioExperienceIssues } from '../../../../shared/scenario-experience.ts';
import { canvasSchema } from '../../../../shared/design-canvas.ts';

test('non-interactive expression preserves the intended experience without a user operation', () => {
  const scenario = createScenarioSchema.parse({ name: '朝の庭', actor: '眺める人', category: 'expression',
    goal: '夜から朝へ光が変わる', experience: '一日の始まりを穏やかに感じる', successOutcome: '朝の柔らかさが伝わる', visualDirection: '光は淡い黄色。影が少しずつ短くなる。' });
  assert.deepEqual(scenarioExperienceIssues(scenario), []);
  assert.ok(scenarioExperienceIssues({ ...scenario, visualDirection: '' }).length);
  assert.equal(createScenarioSchema.safeParse({ ...scenario, experience: ' ' }).success, false);
  assert.equal(createScenarioSchema.safeParse({ ...scenario, category: 'unknown' }).success, false);
  const patch = updateScenarioSchema.parse({ expectedRevision: 1, name: '朝の演出' });
  assert.equal(patch.category, undefined); // PATCH must not reset an expression to gameplay.
});

test('a scenario stores a versioned scene reference with only its extra parts', () => {
  const frame = { id: 'f', name: '庭', description: '', states: [], x: 0, y: 0, width: 1280, height: 720,
    viewport: { width: 1280, height: 720 }, scene_ref: { layout_id: 'scene', frame_id: 'base', revision: 3 } };
  const canvas = canvasSchema.parse({ expected_revision: 0, frames: [frame], elements: [], transitions: [] });
  assert.deepEqual(canvas.frames[0]?.scene_ref, frame.scene_ref);
  assert.equal(canvas.elements.length, 0);
  assert.equal(canvasSchema.safeParse({ ...canvas, frames: [{ ...frame, scene_ref: { ...frame.scene_ref, revision: -1 } }] }).success, false);
});
