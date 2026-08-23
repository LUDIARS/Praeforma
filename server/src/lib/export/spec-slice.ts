// 仕様書の「対象節だけ」を切り出す (feature/screen-flow.md §6.2)。 Cc 送出ペイロード用の純関数。
//
// @spec 6.2 送出ペイロード

import { transitionEdgeLabel, type ExportModel, type ExportWidget } from './model.ts';

export interface SpecSlice {
  title: string;
  anatomiaDomain: string | null;
  markdown: string;
}

function widgetMap(model: ExportModel): Map<string, ExportWidget> {
  const m = new Map<string, ExportWidget>();
  for (const s of model.screens) for (const w of s.widgets) m.set(w.placementId, w);
  return m;
}

export function sliceSpecForTarget(
  model: ExportModel,
  kind: 'spec' | 'layout' | 'transition',
  id: string,
): SpecSlice | null {
  const screenName = new Map(model.screens.map((s) => [s.id, s.name] as const));
  if (kind === 'layout') {
    const s = model.screens.find((x) => x.id === id);
    if (!s) return null;
    const lines = [`## 画面: ${s.name}`, ''];
    if (s.description) lines.push(s.description, '');
    lines.push('### UI 要素');
    for (const w of s.widgets) lines.push(`- ${w.name} (${w.widget ?? '-'}) 表示「${w.label ?? '-'}」 action=${w.action ?? '-'}`);
    lines.push('', '### 要件');
    for (const r of s.requirements) {
      lines.push(`- ${r.code} ${r.title}: ${r.description ?? ''}`);
      for (const a of r.acceptance) lines.push(`  - [ ] ${a}`);
    }
    lines.push('', '### 遷移');
    const wm = widgetMap(model);
    for (const t of model.transitions.filter((t) => t.fromLayoutId === s.id)) {
      lines.push(`- ${transitionEdgeLabel(t, wm)} → ${screenName.get(t.toLayoutId) ?? t.toLayoutId}`);
    }
    return { title: `画面 ${s.name}`, anatomiaDomain: s.anatomiaDomain, markdown: lines.join('\n') };
  }
  if (kind === 'transition') {
    const t = model.transitions.find((x) => x.id === id);
    if (!t) return null;
    const from = model.screens.find((s) => s.id === t.fromLayoutId);
    const wm = widgetMap(model);
    const label = transitionEdgeLabel(t, wm);
    const lines = [
      `## 遷移: ${from?.name ?? t.fromLayoutId} → ${screenName.get(t.toLayoutId) ?? t.toLayoutId}`,
      '',
      `- 起点: ${t.sourcePlacementId ? (wm.get(t.sourcePlacementId)?.label ?? wm.get(t.sourcePlacementId)?.name ?? '-') : '(画面)'}`,
      `- trigger: ${t.trigger}`,
      `- condition: ${t.condition || '(なし)'}`,
      `- label: ${label}`,
    ];
    return { title: `遷移 ${label}`, anatomiaDomain: from?.anatomiaDomain ?? null, markdown: lines.join('\n') };
  }
  // spec: 画面 / ドメインに紐づく要件から code 一致を探す
  for (const s of model.screens) {
    const r = s.requirements.find((x) => x.code === id);
    if (r) {
      const lines = [`## 要件 ${r.code}: ${r.title}`, '', `画面: ${s.name}`, '', r.description ?? '', '', '### 受入条件'];
      for (const a of r.acceptance) lines.push(`- [ ] ${a}`);
      return { title: `要件 ${r.code}`, anatomiaDomain: s.anatomiaDomain, markdown: lines.join('\n') };
    }
  }
  for (const d of model.domains) {
    const r = d.requirements.find((x) => x.code === id);
    if (r) {
      const lines = [`## 要件 ${r.code}: ${r.title}`, '', `ドメイン: ${d.name}`, '', r.description ?? '', '', '### 受入条件'];
      for (const a of r.acceptance) lines.push(`- [ ] ${a}`);
      return { title: `要件 ${r.code}`, anatomiaDomain: d.anatomiaDomain, markdown: lines.join('\n') };
    }
  }
  return null;
}
