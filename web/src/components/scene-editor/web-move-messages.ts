import type { WebMoveError, WebMoveKind } from '../../../../shared/web-scene-move.ts';
import type { WebPlacementDevice } from '../../../../shared/web-scene-placement.ts';

const errorMessages: Record<WebMoveError, string> = {
  unknown_node: '移動する要素が見つかりません。プレビューを選び直してください。',
  unknown_parent: '移動先の要素が見つかりません。プレビューを選び直してください。',
  unknown_sibling: '移動先の並び位置が見つかりません。プレビューを選び直してください。',
  text_node: '文言(text)は位置を持てません。親要素を選んでグループ移動してください。',
  unreadable_offset: 'この要素の位置CSS（translate）をpxの値として読めません。CSSクラス定義で確認してください。',
  too_many_classes: 'この要素のCSSクラスが30個に達しているため、位置を保存できません。',
  too_many_rules: 'CSS規則が200件に達しているため、位置を保存できません。',
  cycle: '要素を自分自身や子孫の中へは移動できません。',
  childless_parent: 'input・br・hr・文言の中へは移動できません。',
  too_deep: 'DOMの深さが32を超えるため、ここへは移動できません。',
};

export function moveErrorMessage(reason: WebMoveError): string {
  return errorMessages[reason];
}

export function placementDeviceLabel(device: WebPlacementDevice): string {
  return device === 'mobile' ? 'スマホ（767px以下）' : 'PC（768px以上）';
}

export function moveStatusMessage(kind: WebMoveKind, moved: string, parent: string, device: WebPlacementDevice): string {
  switch (kind) {
    case 'group': return `${moved} を子孫ごと移動し、${placementDeviceLabel(device)}の位置CSSに保存しました。`;
    case 'detach': return `${moved} を親から分離し、${parent} へ移しました。`;
    case 'merge': return `${moved} を ${parent} へ統合しました。`;
    case 'reorder': return `${moved} の並び順を変えました。`;
  }
}
