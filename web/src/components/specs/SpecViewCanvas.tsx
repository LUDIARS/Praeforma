import React from 'react';
import { SPEC_VIEW_PALETTE, type SpecViewDocument } from '../../../../shared/spec-view.ts';

/**
 * 仕様書可視化ビューの図だけを描く。表示の切り替えや書き出しは持たない。
 * Tela の spec_view_document.cpp と同じ配置・同じ色で描くことで、
 * Pf の画面と Tela のオーバーレイが同じ絵になる。
 */
export function SpecViewCanvas({ document }: { document: SpecViewDocument }): React.ReactElement {
  const colors = new Map(document.groups.map((group, index) => [group.id, SPEC_VIEW_PALETTE[index % SPEC_VIEW_PALETTE.length]!]));
  const visible = new Set(document.groups.filter(group => group.visible).map(group => group.id));
  return <svg className="spec-view-canvas" viewBox={`0 0 ${document.width} ${document.height}`}
    role="img" aria-label={`${document.project} の仕様 ${document.cards.length} 件`}>
    {document.groups.filter(group => visible.has(group.id)).map(group => {
      const first = document.cards.find(card => card.groupId === group.id);
      if (!first) return null;
      return <text key={group.id} x={first.x} y={first.y - 12} className="spec-view-group-name" fill={colors.get(group.id)}>
        {group.name}
      </text>;
    })}
    {document.cards.filter(card => visible.has(card.groupId)).map(card => {
      const color = colors.get(card.groupId);
      return <g key={`${card.groupId}/${card.code}`}>
        <rect x={card.x} y={card.y} width={card.width} height={card.height} rx={6}
          fill={color} fillOpacity={0.19} stroke={color} strokeWidth={1.5} />
        <text x={card.x + 12} y={card.y + 26} className="spec-view-card-code" fill={color}>
          {card.code} · {card.status} v{card.version}
        </text>
        <foreignObject x={card.x + 12} y={card.y + 34} width={card.width - 24} height={card.height - 44}>
          <div className="spec-view-card-title">{card.title}</div>
        </foreignObject>
      </g>;
    })}
  </svg>;
}
