import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import criteria from './project-home.contract.ts';

// Server-side rendering checks the document structure without serving styles or starting a service.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { renderHomeFixture } = await import('./project-home-fixture.ts');
for (const view of ['tabs', 'dashboard', 'review', 'scenes', 'ux']) {
  test(`project home markup: ${view}`, () => {
    assert.equal(criteria.post(renderHomeFixture(view), view), true);
  });
}
