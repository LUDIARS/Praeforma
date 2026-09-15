import { telaCoordinate, telaField } from './tela-record-format.ts';
import type { SpecViewDocument } from './spec-view.ts';

/** Tela の読み込み側と同じ上限。超過は切り詰めずに書き出しを失敗させる。 */
export const TELA_SPEC_VIEW_MAX_GROUPS = 32;
export const TELA_SPEC_VIEW_MAX_CARDS = 256;
const MINIMUM_EXPORTED_SIZE = 0.01;

const size = (value: number): string => telaCoordinate(Math.max(MINIMUM_EXPORTED_SIZE, value));

/**
 * 仕様書可視化ビューを `TELA_SPEC_VIEW 1` として直列化する。
 * カードの座標は view の座標系そのままで、Tela が view を一度だけビューポートへ収める。
 * visible はTela 側のグループ切り替えの初期値であり、Pf へは書き戻らない。
 */
export function telaSpecView(document: SpecViewDocument): string {
  if (document.groups.length === 0) throw new Error('書き出せる仕様がありません。');
  if (document.groups.length > TELA_SPEC_VIEW_MAX_GROUPS)
    throw new Error(`Tela へ書き出せるグループは${TELA_SPEC_VIEW_MAX_GROUPS}件までです。`);
  if (document.cards.length > TELA_SPEC_VIEW_MAX_CARDS)
    throw new Error(`Tela へ書き出せる仕様は${TELA_SPEC_VIEW_MAX_CARDS}件までです（現在${document.cards.length}件）。`);
  const lines = [
    'TELA_SPEC_VIEW 1',
    `view ${telaField(document.project)} ${telaField(document.version)} ${size(document.width)} ${size(document.height)}`,
  ];
  for (const group of document.groups) lines.push(`group ${telaField(group.id)} ${telaField(group.name)} ${group.visible ? 1 : 0}`);
  for (const card of document.cards) {
    lines.push([
      'card', telaField(card.groupId), telaField(card.code), telaField(card.title), telaField(card.status),
      String(Math.trunc(card.version)),
      telaCoordinate(card.x), telaCoordinate(card.y), size(card.width), size(card.height),
    ].join(' '));
  }
  return `${lines.join('\n')}\n`;
}
