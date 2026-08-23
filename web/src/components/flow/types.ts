// Screen Flow 画面の共有型 (選択対象 = トークエリアの会話対象)。
//
// @spec 5.1 画面構成

import type { ConversationTargetKind } from '../../lib/screen-flow-api.ts';

export interface Selection {
  kind: ConversationTargetKind;
  id: string;
  name: string;
}

/** 画面上の UI 要素 (layout_objects 行 + object 情報 + attrs)。 */
export interface WidgetRow {
  placementId: string;
  objectId: string;
  name: string;
  widget: string | null;
  label: string | null;
}

export interface ScreenRow {
  id: string;
  name: string;
  widgets: WidgetRow[];
}
