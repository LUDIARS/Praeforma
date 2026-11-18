import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectDashboard } from '../src/components/dashboard/ProjectDashboard.tsx';
import { SpecReviewHome } from '../src/components/specs/SpecReviewHome.tsx';
import { SceneMapView } from '../src/components/scene-map/SceneMapView.tsx';
import { UxDefinitionView } from '../src/components/ux-definition/UxDefinitionView.tsx';
import { ProjectTabs } from '../src/components/ProjectTabs.tsx';
import { contract } from '@ludiars/log-weaver'; /* augur-inject:import:c2465d75 */
import augurContract_bbeebacf from './project-home.contract.ts'; /* augur-inject:contract-predicate:63177745 */

const pid = 'fixture';
const noop = () => {};

export function renderHomeFixture(view: 'tabs' | 'dashboard' | 'review' | 'scenes' | 'ux'): string {
  const client = new QueryClient();
  client.setQueryData(['project-events', pid], { items: [
    { id: 'a', kind: 'spec', title: '仕様の更新', at: '2026-11-19T12:00:00Z' },
    { id: 'b', kind: 'actor', title: '追加', at: '2026-11-19T11:59:00Z' },
    { id: 'c', kind: 'spec', title: '作成', at: '2026-11-17T12:00:00Z' },
  ] });
  client.setQueryData(['specs', pid], { items: [
    { id: 's', code: 'S1', title: '入力', status: 'review', preconditions: [], postconditions: [] },
  ] });
  client.setQueryData(['spec-fragments', pid, 0], { items: [
    { id: 'f', content: '入力案', implementationState: 'implemented', disposition: { state: 'integrated' }, createdAt: '2026-11-19' },
  ] });
  client.setQueryData(['scene-map', pid], { scenes: [
    { id: 'start', name: '開始地点', kind: 'screen', specs: [], incomingCount: 2,
      outgoing: [{ id: 'exit', toLayoutId: 'start', toName: '開始地点', trigger: 'tap' }] },
  ], unplacedSpecs: [] });
  const views = {
    tabs: h(ProjectTabs, { pid, tab: 'dashboard', onChange: noop }),
    dashboard: h(ProjectDashboard, { pid, onOpenTab: noop }),
    review: h(SpecReviewHome, { pid, focus: null, onOpenSpecs: noop }),
    scenes: h(SceneMapView, { pid, onOpenSpec: noop }),
    ux: h(UxDefinitionView, { pid }),
  };
  return renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, null, views[view])));
}
// @ts-expect-error augur-inject
renderHomeFixture = contract(renderHomeFixture, { ...augurContract_bbeebacf, contractId: 'C-10', mode: 'observe', sample: 1, where: 'web/checks/project-home-fixture.ts:14', rule: 'contract-wrap', id: 'bbeebacf' }); /* augur-inject:contract-wrap:bbeebacf */
