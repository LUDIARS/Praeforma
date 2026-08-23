// 書き出し用の読み取りモデル (feature/screen-flow.md §7)。
// DB 行をここへ正規化し、 生成器 (flow-mermaid / spec-markdown) は DB を知らない純関数にする。
//
// @spec 7. 生成物の形式

export interface ExportWidget {
  /** layout_objects.id (遷移の起点 id) */
  placementId: string;
  objectId: string;
  /** objects.label (識別名) */
  name: string;
  /** attrs: widget / label / action */
  widget: string | null;
  label: string | null;
  action: string | null;
  domainName: string | null;
}

export interface ExportRequirement {
  code: string;
  title: string;
  description: string | null;
  priority: string;
  category: string;
  acceptance: string[];
}

export interface ExportTransition {
  id: string;
  fromLayoutId: string;
  toLayoutId: string;
  sourcePlacementId: string | null;
  trigger: string;
  condition: string;
  label: string | null;
  ordinal: number;
}

export interface ExportScreen {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  /** 画面に紐づく主ドメイン (UI 要素のドメインの最頻値) と Anatomia 射影 */
  domainName: string | null;
  anatomiaDomain: string | null;
  widgets: ExportWidget[];
  requirements: ExportRequirement[];
}

export interface ExportDomain {
  id: string;
  name: string;
  description: string | null;
  anatomiaDomain: string | null;
  requirements: ExportRequirement[];
}

export interface ExportCcLink {
  targetKind: string;
  targetId: string;
  ccKind: string;
  ccId: string;
  status: string;
}

export interface ExportModel {
  projectName: string;
  anatomiaRepo: string | null;
  screens: ExportScreen[];
  transitions: ExportTransition[];
  domains: ExportDomain[];
  ccLinks: ExportCcLink[];
}

/** 遷移の辺ラベルを合成する: label > "[起点label] trigger" + " / condition"。 */
export function transitionEdgeLabel(
  t: ExportTransition,
  widgetByPlacement: ReadonlyMap<string, ExportWidget>,
): string {
  let base = t.label?.trim() ?? '';
  if (!base) {
    const w = t.sourcePlacementId ? widgetByPlacement.get(t.sourcePlacementId) : undefined;
    const origin = w ? `[${w.label ?? w.name}] ` : '';
    base = `${origin}${t.trigger}`;
  }
  return t.condition ? `${base} / ${t.condition}` : base;
}
