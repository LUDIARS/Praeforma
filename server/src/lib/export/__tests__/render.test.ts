// 書き出しの決定性 + 形式 (feature/screen-flow.md §7)。 `npm test -w server`。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFlowMermaid, mermaidId, mermaidText } from '../flow-mermaid.ts';
import { renderSpecMarkdown } from '../spec-markdown.ts';
import { sliceSpecForTarget } from '../spec-slice.ts';
import type { ExportModel } from '../model.ts';

const model: ExportModel = {
  projectName: 'Demo',
  anatomiaRepo: 'demo',
  screens: [
    {
      id: 'L2', name: 'ホーム', description: null, kind: 'screen', domainName: 'UI', anatomiaDomain: 'web-editor',
      widgets: [{ placementId: 'P2', objectId: 'O2', name: 'settings', widget: 'button', label: '設定', action: 'navigate', domainName: 'UI' }],
      requirements: [{ code: 'SF-002', title: 'ホーム表示', description: 'd', priority: 'must', category: 'behavior', acceptance: ['a1'] }],
    },
    {
      id: 'L1', name: 'タイトル', description: '起動直後', kind: 'screen', domainName: 'UI', anatomiaDomain: null,
      widgets: [{ placementId: 'P1', objectId: 'O1', name: 'start', widget: 'button', label: 'スタート', action: 'navigate', domainName: 'UI' }],
      requirements: [],
    },
  ],
  transitions: [
    { id: 'T1', fromLayoutId: 'L1', toLayoutId: 'L2', sourcePlacementId: 'P1', trigger: 'tap', condition: '', label: null, ordinal: 0 },
    { id: 'T2', fromLayoutId: 'L2', toLayoutId: 'L1', sourcePlacementId: null, trigger: 'timeout', condition: '30s 無操作', label: null, ordinal: 0 },
  ],
  domains: [{ id: 'D1', name: 'UI', description: null, anatomiaDomain: 'web-editor', requirements: [] }],
  ccLinks: [],
};

test('mermaid: 決定的で画面名順、辺ラベルは [起点] trigger / condition', () => {
  const a = renderFlowMermaid(model);
  const b = renderFlowMermaid(structuredClone(model));
  assert.equal(a, b);
  assert.match(a, /^flowchart LR\n/);
  assert.ok(a.indexOf('s_L1["タイトル"]') < a.indexOf('s_L2["ホーム"]'));
  assert.ok(a.includes('s_L1 -->|"[スタート] tap"| s_L2'));
  assert.ok(a.includes('s_L2 -->|"timeout / 30s 無操作"| s_L1'));
});

test('mermaid: group=domain で subgraph、未連携は「未連携」', () => {
  const out = renderFlowMermaid(model, { groupBy: 'domain' });
  assert.ok(out.includes('subgraph s_g_web_editor["web-editor"]'));
  assert.ok(out.includes('["未連携"]'));
});

test('mermaid id/text の無害化', () => {
  assert.equal(mermaidId('01HX-abc'), 's_01HX_abc');
  assert.equal(mermaidText('a "b"\nc'), "a 'b' c");
});

test('mermaid: id に潰れると同じになるドメイン名でも subgraph は分かれる', () => {
  const collide: ExportModel = {
    ...model,
    screens: [
      { ...model.screens[0]!, id: 'LA', name: 'A', anatomiaDomain: 'ui-core' },
      { ...model.screens[1]!, id: 'LB', name: 'B', anatomiaDomain: 'ui_core' },
    ],
    transitions: [],
  };
  const out = renderFlowMermaid(collide, { groupBy: 'domain' });
  assert.ok(out.includes('subgraph s_g_ui_core["ui-core"]'));
  assert.ok(out.includes('subgraph s_g_ui_core_2["ui_core"]'));
  assert.equal(out.match(/subgraph /g)?.length, 2);
});

test('spec.md: 見出し構成と domain コメント、決定的', () => {
  const md = renderSpecMarkdown(model);
  assert.equal(md, renderSpecMarkdown(structuredClone(model)));
  assert.ok(md.startsWith('# Demo 画面仕様書'));
  for (const h of ['## 1. 画面一覧', '## 2. 画面遷移図', '## 3. 画面ごとの仕様', '## 4. ドメイン共通仕様']) assert.ok(md.includes(h), h);
  assert.ok(!md.includes('## 5. Cc 接続状況'));
  assert.ok(md.includes('<!-- domain: UI (anatomia: web-editor) -->'));
  assert.ok(md.includes('<!-- domain: UI (anatomia: 未連携) -->'));
  assert.ok(md.includes('| settings | button | 設定 | navigate | - |'));
  assert.ok(md.includes('| start | button | スタート | navigate | ホーム |'));
  assert.ok(md.includes('- [ ] a1'));
});

test('spec.md: cc_links があれば §5 が出る', () => {
  const md = renderSpecMarkdown({ ...model, ccLinks: [{ targetKind: 'layout', targetId: 'L2', ccKind: 'delegation_run', ccId: 'run1', status: 'running' }] });
  assert.ok(md.includes('## 5. Cc 接続状況'));
  assert.ok(md.includes('| layout:L2 | delegation_run | run1 | running |'));
});

test('slice: 対象節だけ + anatomia_domain を持ち帰る', () => {
  const s = sliceSpecForTarget(model, 'layout', 'L2');
  assert.ok(s && s.anatomiaDomain === 'web-editor' && s.markdown.includes('## 画面: ホーム'));
  const t = sliceSpecForTarget(model, 'transition', 'T1');
  assert.ok(t && t.anatomiaDomain === null && t.markdown.includes('[スタート] tap'));
  const r = sliceSpecForTarget(model, 'spec', 'SF-002');
  assert.ok(r && r.anatomiaDomain === 'web-editor' && r.markdown.includes('- [ ] a1'));
  assert.equal(sliceSpecForTarget(model, 'spec', 'nope'), null);
});
