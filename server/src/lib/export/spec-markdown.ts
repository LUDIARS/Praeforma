// 仕様書 (Markdown + Mermaid) 生成 — feature/screen-flow.md §7.2。 決定的な純関数。
// LLM は使わない (中身は会話で作り、 ここは機械整形のみ)。
//
// @spec 7.2 仕様書

import { renderFlowMermaid } from './flow-mermaid.ts';
import {
  type ExportModel,
  type ExportRequirement,
  type ExportScreen,
  type ExportWidget,
} from './model.ts';

function cell(s: string | null | undefined): string {
  return (s ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim() || '-';
}

function domainComment(domainName: string | null, anatomia: string | null): string {
  const d = domainName ?? '-';
  const a = anatomia ?? '未連携';
  return `<!-- domain: ${d} (anatomia: ${a}) -->`;
}

function requirementsBlock(reqs: ExportRequirement[]): string[] {
  if (reqs.length === 0) return ['- (要件なし)'];
  const out: string[] = [];
  for (const r of [...reqs].sort((a, b) => a.code.localeCompare(b.code))) {
    out.push(`- **${r.code}** ${r.title} (${r.priority} / ${r.category})`);
    if (r.description) out.push(`  - ${r.description.replace(/[\r\n]+/g, ' ')}`);
    for (const a of r.acceptance) out.push(`  - [ ] ${a.replace(/[\r\n]+/g, ' ')}`);
  }
  return out;
}

function screenSection(
  index: number,
  s: ExportScreen,
  model: ExportModel,
  widgetByPlacement: ReadonlyMap<string, ExportWidget>,
  screenName: ReadonlyMap<string, string>,
): string[] {
  const out: string[] = [];
  out.push(`### 3.${index} ${s.name}  ${domainComment(s.domainName, s.anatomiaDomain)}`);
  out.push('');
  if (s.description) {
    out.push(s.description.trim());
    out.push('');
  }
  const outgoing = model.transitions
    .filter((t) => t.fromLayoutId === s.id)
    .sort((a, b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id));

  out.push('#### UI 要素');
  out.push('');
  if (s.widgets.length === 0) {
    out.push('(UI 要素なし)');
  } else {
    out.push('| 要素 | widget | 表示文言 | action | 遷移先 |');
    out.push('|---|---|---|---|---|');
    for (const w of s.widgets) {
      const targets = outgoing
        .filter((t) => t.sourcePlacementId === w.placementId)
        .map((t) => screenName.get(t.toLayoutId) ?? t.toLayoutId);
      out.push(
        `| ${cell(w.name)} | ${cell(w.widget)} | ${cell(w.label)} | ${cell(w.action)} | ${cell(targets.join(', '))} |`,
      );
    }
  }
  out.push('');
  out.push('#### 要件');
  out.push('');
  out.push(...requirementsBlock(s.requirements));
  out.push('');
  out.push('#### 遷移');
  out.push('');
  if (outgoing.length === 0) {
    out.push('(遷移なし)');
  } else {
    out.push('| 起点 | trigger | 条件 | 遷移先 |');
    out.push('|---|---|---|---|');
    for (const t of outgoing) {
      const w = t.sourcePlacementId ? widgetByPlacement.get(t.sourcePlacementId) : undefined;
      const origin = w ? (w.label ?? w.name) : '(画面)';
      out.push(
        `| ${cell(origin)} | ${cell(t.trigger)} | ${cell(t.condition)} | ${cell(screenName.get(t.toLayoutId) ?? t.toLayoutId)} |`,
      );
    }
  }
  out.push('');
  return out;
}

export function renderSpecMarkdown(model: ExportModel): string {
  const screens = [...model.screens].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const screenName = new Map(screens.map((s) => [s.id, s.name] as const));
  const widgetByPlacement = new Map<string, ExportWidget>();
  for (const s of screens) for (const w of s.widgets) widgetByPlacement.set(w.placementId, w);

  const out: string[] = [];
  out.push(`# ${model.projectName} 画面仕様書`);
  out.push('');
  if (model.anatomiaRepo) out.push(`Anatomia project: \`${model.anatomiaRepo}\``);
  out.push('');
  out.push('## 1. 画面一覧');
  out.push('');
  out.push('| 画面 | ドメイン (anatomia) | UI 要素数 | 遷移数 |');
  out.push('|---|---|---|---|');
  for (const s of screens) {
    const n = model.transitions.filter((t) => t.fromLayoutId === s.id).length;
    out.push(
      `| ${cell(s.name)} | ${cell(s.domainName)} (${cell(s.anatomiaDomain ?? '未連携')}) | ${s.widgets.length} | ${n} |`,
    );
  }
  out.push('');
  out.push('## 2. 画面遷移図');
  out.push('');
  out.push('```mermaid');
  out.push(renderFlowMermaid(model).trimEnd());
  out.push('```');
  out.push('');
  out.push('## 3. 画面ごとの仕様');
  out.push('');
  screens.forEach((s, i) => out.push(...screenSection(i + 1, s, model, widgetByPlacement, screenName)));

  out.push('## 4. ドメイン共通仕様');
  out.push('');
  const domains = [...model.domains].sort((a, b) => a.name.localeCompare(b.name));
  if (domains.length === 0) out.push('(ドメインなし)');
  for (const d of domains) {
    out.push(`### ${d.name}  ${domainComment(d.name, d.anatomiaDomain)}`);
    out.push('');
    if (d.description) {
      out.push(d.description.trim());
      out.push('');
    }
    out.push(...requirementsBlock(d.requirements));
    out.push('');
  }

  if (model.ccLinks.length > 0) {
    out.push('## 5. Cc 接続状況');
    out.push('');
    out.push('| 対象 | 種別 | Cc id | 状態 |');
    out.push('|---|---|---|---|');
    for (const l of [...model.ccLinks].sort((a, b) => a.ccId.localeCompare(b.ccId))) {
      out.push(`| ${cell(`${l.targetKind}:${l.targetId}`)} | ${cell(l.ccKind)} | ${cell(l.ccId)} | ${cell(l.status)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}
