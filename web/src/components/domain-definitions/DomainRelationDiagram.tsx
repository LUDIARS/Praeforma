import React from 'react';
import type { DefinedDomain } from '../../lib/domain-definitions-api.ts';
import { domainRelations, type DomainMembership } from '../../../../shared/domain-relations.ts';

export function DomainRelationDiagram({ domains, memberships, onEdit }: {
  domains: DefinedDomain[]; memberships: DomainMembership[]; onEdit: (domain: DefinedDomain) => void;
}): React.ReactElement {
  const [scale, setScale] = React.useState(1);
  const arrow = React.useId().replace(/:/g, '');
  const groups = [
    { kind: 'core', label: 'コアドメイン', color: '#8054bd' },
    { kind: 'business', label: 'ビジネスドメイン', color: '#286fa8' },
    { kind: null, label: '未分類', color: '#67717e' },
  ];
  const positions = new Map<string, { x: number; y: number; color: string }>();
  let height = 200;
  groups.forEach((group, column) => {
    const members = domains.filter(domain => domain.definitionKind === group.kind);
    height = Math.max(height, 70 + members.length * 120);
    members.forEach((domain, row) => positions.set(domain.id, { x: 40 + column * 340, y: 60 + row * 120, color: group.color }));
  });
  const edges = domainRelations(domains, memberships);
  return <section className="panel" aria-label="ドメイン関係図">
    <h3>ドメイン関係図</h3>
    <p>実線：コアからビジネスへの所属　破線：親から子への関係。各ボックスから定義を開けます。</p>
    <label>表示倍率 <input type="range" min="0.5" max="1.5" step="0.1" value={scale} onChange={event => setScale(Number(event.target.value))} /> {Math.round(scale * 100)}%</label>
    {!domains.length ? <p>ドメインを登録すると関係図が表示されます。</p> : <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
      <svg width={1040 * scale} height={height * scale} viewBox={`0 0 1040 ${height}`} role="group" aria-label="ドメインの所属と親子関係">
        <defs><marker id={arrow} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#667085" /></marker></defs>
        {groups.map((group, index) => <text key={group.label} x={40 + index * 340} y={30} fill="currentColor">{group.label}</text>)}
        {edges.map(edge => {
          const from = positions.get(edge.from), to = positions.get(edge.to);
          if (!from || !to) return null;
          const x1 = from.x + 220, x2 = to.x > from.x ? to.x : to.x + 220;
          const bend = to.x > from.x ? (x1 + x2) / 2 : Math.max(x1, x2) + 70;
          return <path key={`${edge.from}:${edge.to}`} d={`M${x1},${from.y + 40} C${bend},${from.y + 40} ${bend},${to.y + 40} ${x2},${to.y + 40}`}
            fill="none" stroke="#667085" strokeWidth="2" strokeDasharray={edge.kind === 'parent' ? '6 4' : undefined} markerEnd={`url(#${arrow})`}>
            <title>{domains.find(d => d.id === edge.from)?.name} → {domains.find(d => d.id === edge.to)?.name}</title>
          </path>;
        })}
        {domains.map(domain => {
          const pos = positions.get(domain.id);
          if (!pos) return null;
          return <g key={domain.id}><rect x={pos.x} y={pos.y} width="220" height="80" rx="8" fill="var(--panel)" stroke={pos.color} strokeWidth="2" />
            <foreignObject x={pos.x + 4} y={pos.y + 4} width="212" height="72">
              <button type="button" className="ghost" style={{ width: '100%', height: '100%', overflow: 'auto', overflowWrap: 'anywhere', whiteSpace: 'normal' }} onClick={() => onEdit(domain)} title={domain.description ?? domain.name}>{domain.name}</button>
            </foreignObject>
          </g>;
        })}
      </svg>
    </div>}
  </section>;
}
