/**
 * 仕様書可視化ビュー (PF-SPEC-VIEW)。構造化仕様を選んだ軸でグループへ分け、
 * 決定的な格子へ並べる。並びは書き出しと画面で同じものを使う。
 */

export type SpecViewAxis = 'status' | 'category' | 'priority';

/** 可視化に使う仕様の項目だけを受け取る。本文・出典・履歴は持ち込まない。 */
export interface SpecViewSpec {
  code: string;
  title: string;
  status: string;
  category: string | null;
  priority: string | null;
  version: number;
}

export interface SpecViewGroup { id: string; name: string; visible: boolean }
export interface SpecViewCard {
  groupId: string; code: string; title: string; status: string; version: number;
  x: number; y: number; width: number; height: number;
}
export interface SpecViewDocument {
  project: string; version: string;
  width: number; height: number;
  groups: readonly SpecViewGroup[];
  cards: readonly SpecViewCard[];
}

export const SPEC_VIEW_COLUMNS = 4;
const CARD_WIDTH = 260, CARD_HEIGHT = 96;
const GAP = 16, PADDING = 24, GROUP_HEADER = 32, GROUP_GAP = 28;

/** 軸ごとの並び順。ここに無い値は「その他」へ落とす。 */
const AXIS_GROUPS: Record<SpecViewAxis, readonly (readonly [string, string])[]> = {
  status: [['draft', '下書き'], ['review', 'レビュー中'], ['approved', '確定'], ['obsolete', '廃止']],
  category: [['behavior', '振る舞い'], ['appearance', '見た目'], ['data', 'データ'], ['interaction', '操作']],
  priority: [['must', '必須'], ['should', '推奨'], ['could', '任意'], ['wont', '対象外']],
};
const OTHER_GROUP = ['other', 'その他'] as const;

export const specViewWidth = (): number => PADDING * 2 + SPEC_VIEW_COLUMNS * CARD_WIDTH + (SPEC_VIEW_COLUMNS - 1) * GAP;

function axisValue(spec: SpecViewSpec, axis: SpecViewAxis): string {
  const value = axis === 'status' ? spec.status : axis === 'category' ? spec.category : spec.priority;
  return value ?? '';
}

/**
 * 軸でグループへ分け、グループを縦に積み、カードを左上から格子に流す。
 * 空のグループは出さない。非表示のグループも配置は保持する（Tela 側で切り替えるため）。
 */
export function specViewDocument(
  project: string, version: string, specs: readonly SpecViewSpec[],
  axis: SpecViewAxis, hidden: ReadonlySet<string> = new Set(),
): SpecViewDocument {
  const order = [...AXIS_GROUPS[axis], OTHER_GROUP];
  const groups: SpecViewGroup[] = [];
  const cards: SpecViewCard[] = [];
  let y = PADDING;
  for (const [id, name] of order) {
    const members = specs
      .filter(spec => (order.some(([key]) => key === axisValue(spec, axis)) ? axisValue(spec, axis) : OTHER_GROUP[0]) === id)
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code));
    if (members.length === 0) continue;
    groups.push({ id, name, visible: !hidden.has(id) });
    y += GROUP_HEADER;
    members.forEach((spec, index) => {
      const column = index % SPEC_VIEW_COLUMNS, row = Math.floor(index / SPEC_VIEW_COLUMNS);
      cards.push({
        groupId: id, code: spec.code, title: spec.title, status: spec.status, version: spec.version,
        x: PADDING + column * (CARD_WIDTH + GAP), y: y + row * (CARD_HEIGHT + GAP),
        width: CARD_WIDTH, height: CARD_HEIGHT,
      });
    });
    const rows = Math.ceil(members.length / SPEC_VIEW_COLUMNS);
    y += rows * CARD_HEIGHT + (rows - 1) * GAP + GROUP_GAP;
  }
  return { project, version, width: specViewWidth(), height: Math.max(y - GROUP_GAP + PADDING, PADDING * 2), groups, cards };
}

/** グループの色。Tela の spec_view_document.cpp の palette と同じ並びを保つ。 */
export const SPEC_VIEW_PALETTE = ['#78c8ff', '#ffc45a', '#96e696', '#ff8caa', '#c8a0ff', '#f0f078'] as const;
