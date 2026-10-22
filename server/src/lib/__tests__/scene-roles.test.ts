import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneRoles } from '../../../../shared/scene-roles.ts';

const frame = (id: string, name: string) => ({ id, name, description: '', states: [], x: 0, y: 0, width: 390, height: 844, viewport: { width: 390, height: 844 } });
const element = (id: string, frameId: string, patch: Record<string, unknown> = {}) => ({
  id, frame_id: frameId, kind: 'button' as const, label: id, x: 0, y: 0, width: 100, height: 40, sample_text: null, dynamic: null, follow: null, ...patch,
});

test('PF-SCENE-9 groups each drawn object role under its frame, apart from drawing data', () => {
  const canvas = {
    frames: [{ ...frame('home', 'Home'), description: 'Hub', states: [{ id: 's', name: 'loading', condition: '', content: '' }] }, frame('training', 'Training')],
    elements: [
      element('start', 'home'),
      element('score', 'home', { kind: 'text', dynamic: { enabled: true, source: 'PlayData.score', update_condition: null } }),
      element('badge', 'home', { follow: { target_element_id: 'score', condition: 'while visible' } }),
      element('plain', 'training'),
    ],
    transitions: [
      { id: 't1', from: { frame_id: 'home', element_id: 'start' }, to_frame_id: 'training', trigger: 'tap', label: 'Start' },
      { id: 't2', from: { frame_id: 'home', element_id: null }, to_frame_id: 'gone', trigger: 'timeout', label: 'Idle' },
    ],
  };
  const roles = sceneRoles(canvas);
  assert.equal(roles.length, 2);
  const home = roles[0]!;
  const training = roles[1]!;
  assert.deepEqual(home.stateNames, ['loading']);
  assert.equal(home.description, 'Hub');
  assert.deepEqual(home.transitions, [{ id: 't2', label: 'Idle', trigger: 'timeout', toFrameId: 'gone', toFrameName: null }]);
  assert.deepEqual(home.elements.map(role => role.elementId), ['start', 'score', 'badge']);
  const start = home.elements[0]!;
  const score = home.elements[1]!;
  const badge = home.elements[2]!;
  assert.deepEqual(start.transitions.map(item => item.toFrameName), ['Training']);
  assert.equal(score.node, 'PlayData.score');
  assert.deepEqual(score.dynamic, { updateCondition: null });
  assert.deepEqual(badge.follow, { targetElementId: 'score', targetLabel: 'score', condition: 'while visible' });
  assert.equal(start.described && score.described && badge.described, true);
  assert.equal(training.elements[0]?.described, false);
  assert.deepEqual(training.transitions, []);
});

test('PF-SCENE-9 keeps a node mapping without treating the element as dynamic', () => {
  const canvas = {
    frames: [frame('home', 'Home')],
    elements: [element('logo', 'home', { dynamic: { enabled: false, source: 'Title.Logo', update_condition: null }, follow: { target_element_id: 'missing', condition: '' } })],
    transitions: [],
  };
  const logo = sceneRoles(canvas)[0]?.elements[0];
  assert.ok(logo);
  assert.equal(logo.node, 'Title.Logo');
  assert.equal(logo.dynamic, null);
  assert.equal(logo.follow?.targetLabel, null);
});
