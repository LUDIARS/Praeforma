import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterProjects, parseProjectFilters, serializeProjectFilters } from '../../../../shared/project-index.ts';

test('search and team combine before pagination, including normalized Japanese and Latin text', () => {
  const projects = Array.from({ length: 55 }, (_, index) => ({ name: `作品 ${index}`, description: null, orgId: 'A' }));
  projects.push({ name: 'Ｐｆ ひかりの庭', description: null, orgId: 'B' });
  assert.equal(filterProjects(projects, { query: 'pf 庭', team: 'B' })[0]?.name, 'Ｐｆ ひかりの庭');
  assert.equal(filterProjects(projects, { query: 'pf', team: 'A' }).length, 0);
});

test('saved filters restore and disabling persistence removes the old criteria', () => {
  const saved = { query: '光', team: '制作チーム', remember: true };
  assert.deepEqual(parseProjectFilters(serializeProjectFilters(saved)), saved);
  const disabled = serializeProjectFilters({ ...saved, remember: false });
  assert.equal(disabled.includes('制作チーム'), false);
  assert.deepEqual(parseProjectFilters(disabled), { query: '', team: '', remember: false });
  assert.deepEqual(parseProjectFilters('{broken'), { query: '', team: '', remember: true });
  assert.deepEqual(parseProjectFilters('{"query":3,"team":null}'), { query: '', team: '', remember: true });
});
