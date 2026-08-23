// 遷移図 (Mermaid flowchart) 生成 — feature/screen-flow.md §7.1。 決定的な純関数。
//
//   - ノード = 画面 (layouts)、 辺 = transitions。
//   - group=domain のとき anatomia_domain で subgraph にまとめる (未連携は "未連携")。
//   - Mermaid の id は英数字に限るので画面 id から決定的な id を作る。
//
// @spec 7.1 遷移図

import { transitionEdgeLabel, type ExportModel, type ExportWidget } from './model.ts';

export interface FlowMermaidOptions {
  groupBy?: 'none' | 'domain';
  direction?: 'LR' | 'TB';
}

/** Mermaid のノード id として安全な文字列に落とす (決定的)。 先頭が数字でも良いよう `s_` を付ける。 */
export function mermaidId(id: string): string {
  return `s_${id.replace(/[^A-Za-z0-9_]/g, '_')}`;
}

/** Mermaid のラベル内で壊れる文字を無害化する (" は ' に、 改行は空白に)。 */
export function mermaidText(s: string): string {
  return s.replace(/"/g, "'").replace(/[\r\n]+/g, ' ').trim();
}

export function renderFlowMermaid(model: ExportModel, opts: FlowMermaidOptions = {}): string {
  const direction = opts.direction ?? 'LR';
  const groupBy = opts.groupBy ?? 'none';
  const lines: string[] = [`flowchart ${direction}`];

  const screens = [...model.screens].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const nodeLine = (s: (typeof screens)[number]) =>
    `  ${mermaidId(s.id)}["${mermaidText(s.name)}"]`;

  if (groupBy === 'domain') {
    const groups = new Map<string, typeof screens>();
    for (const s of screens) {
      const key = s.anatomiaDomain ?? '未連携';
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }
    // ドメイン "名" から id を作るので、 別名が同じ id に潰れうる (例 "a-b" と "a_b")。
    // 衝突したときだけ連番を足して、 subgraph が混ざらないようにする。
    const usedGroupIds = new Set<string>();
    for (const key of [...groups.keys()].sort()) {
      const base = mermaidId(`g_${key}`);
      let gid = base;
      for (let n = 2; usedGroupIds.has(gid); n++) gid = `${base}_${n}`;
      usedGroupIds.add(gid);
      lines.push(`  subgraph ${gid}["${mermaidText(key)}"]`);
      for (const s of groups.get(key)!) lines.push(`  ${nodeLine(s)}`);
      lines.push('  end');
    }
  } else {
    for (const s of screens) lines.push(nodeLine(s));
  }

  const widgetByPlacement = new Map<string, ExportWidget>();
  for (const s of model.screens) for (const w of s.widgets) widgetByPlacement.set(w.placementId, w);
  const knownScreen = new Set(model.screens.map((s) => s.id));

  const edges = [...model.transitions]
    .filter((t) => knownScreen.has(t.fromLayoutId) && knownScreen.has(t.toLayoutId))
    .sort(
      (a, b) =>
        a.fromLayoutId.localeCompare(b.fromLayoutId) ||
        a.ordinal - b.ordinal ||
        a.toLayoutId.localeCompare(b.toLayoutId) ||
        a.id.localeCompare(b.id),
    );
  for (const t of edges) {
    const label = mermaidText(transitionEdgeLabel(t, widgetByPlacement));
    lines.push(`  ${mermaidId(t.fromLayoutId)} -->|"${label}"| ${mermaidId(t.toLayoutId)}`);
  }
  return lines.join('\n') + '\n';
}
