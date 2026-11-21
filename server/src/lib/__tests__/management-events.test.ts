import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildManagementEvent, type ManagementChange } from '../management-event-payload.ts';
import { postManagementEvent, resolveManagementEventsUrl } from '../management-events-client.ts';

const endpoint = 'http://127.0.0.1:11111/v1/management/events';
const saved: ManagementChange = {
  entity: 'spec', operation: 'updated', projectId: 'KD', targetId: 'spec-1',
  changeId: 'audit:42', observedAt: '2026-11-21T17:00:00.123Z',
};

test('builds a stable, content-free event for each saved change', () => {
  const event = buildManagementEvent(saved);
  assert.deepEqual(event, {
    event_key: event.event_key,
    source: 'pf', kind: 'spec-updated', project_code: 'KD', target_key: 'spec/spec-1',
    origin: 'human', summary: '仕様を更新しました。', observed_at: 1795280400123,
  });
  assert.match(event.event_key, /^pf:spec:[a-f0-9]{64}$/);
  assert.deepEqual(buildManagementEvent({ ...saved }), event);
  assert.notEqual(buildManagementEvent({ ...saved, changeId: 'audit:43' }).event_key, event.event_key);
  assert.notEqual(buildManagementEvent({ ...saved, projectId: 'other' }).event_key, event.event_key);
  assert.equal(buildManagementEvent({ ...saved, origin: 'ai' }).origin, 'ai');
  const unusual = buildManagementEvent({ ...saved, projectId: '非公開'.repeat(100), targetId: '設計'.repeat(200) });
  assert.match(unusual.project_code, /^pf-[a-f0-9]{32}$/);
  assert.match(unusual.target_key, /^spec\/[a-f0-9]{64}$/);
});

test('opts out silently, selects the configured URL, and rejects unsafe destinations', () => {
  assert.equal(resolveManagementEventsUrl({}), null);
  assert.equal(resolveManagementEventsUrl({ CONCORDIA_MANAGEMENT_EVENTS_URL: 'off', CONCORDIA_URL: endpoint }), null);
  assert.equal(resolveManagementEventsUrl({ CONCORDIA_URL: 'OFF' }), null);
  assert.equal(resolveManagementEventsUrl({ CONCORDIA_URL: 'http://127.0.0.1:11111/foo' }), endpoint);
  assert.equal(resolveManagementEventsUrl({
    CONCORDIA_MANAGEMENT_EVENTS_URL: 'https://cc.example.test/events', CONCORDIA_URL: 'off',
  }), 'https://cc.example.test/events');
  for (const url of ['http://cc.example.test', 'https://user:secret@cc.example.test', 'https://cc.example.test/?token=x']) {
    assert.throws(() => resolveManagementEventsUrl({ CONCORDIA_MANAGEMENT_EVENTS_URL: url }), /invalid_management_events_url/);
  }
});

test('posts JSON once per attempt and classifies receipt, refusal and transient failures', async () => {
  const event = buildManagementEvent(saved);
  const signal = new AbortController().signal;
  for (const [status, expected] of [[200, 'delivered'], [204, 'delivered'], [409, 'refused'], [429, 'refused'], [503, 'retry'], [302, 'retry']] as const) {
    const fetcher: typeof fetch = async (url, request) => {
      assert.equal(url, endpoint);
      assert.equal(request?.method, 'POST');
      assert.equal(request?.redirect, 'manual');
      const headers = new Headers(request.headers);
      assert.equal(headers.get('authorization'), null);
      assert.equal(headers.get('content-type'), 'application/json');
      assert.equal(request.body, JSON.stringify(event));
      return new Response(null, { status });
    };
    assert.equal(await postManagementEvent(endpoint, event, fetcher, signal), expected, String(status));
  }
  assert.equal(await postManagementEvent(endpoint, event, async () => { throw new TypeError('offline'); }, signal), 'retry');
});
