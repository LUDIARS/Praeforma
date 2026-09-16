// @spec PF-DR-4 ドメイン関係図 / PF-DR-6 Tela 書き出し
import React from 'react';
import type { DefinedDomain } from '../../lib/domain-definitions-api.ts';
import type { DomainMembership } from '../../../../shared/domain-relations.ts';
import { domainGraph } from '../../../../shared/domain-graph.ts';
import { telaGraph } from '../../../../shared/tela-graph-export.ts';
import { downloadText } from '../../lib/download-text.ts';

export function DomainRelationDiagram({ project, domains, memberships, onEdit }: {
  project: string; domains: DefinedDomain[]; memberships: DomainMembership[]; onEdit: (domain: DefinedDomain) => void;
}): React.ReactElement {
  const [scale, setScale] = React.useState(1);
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(new Set());
  const [exportError, setExportError] = React.useState('');
  const arrow = React.useId().replace(/:/g, '');
  // 配置と経路は shared/domain-graph.ts が決める。Tela の描画と同じ絵にするための唯一の出どころ。
  const graph = React.useMemo(() => domainGraph(project, domains, memberships), [project, domains, memberships]);
  const colors = new Map(graph.groups.map(group => [group.id, group.color]));
  const shown = new Set(graph.groups.filter(group => !hidden.has(group.id)).map(group => group.id));
  const placed = new Map(graph.nodes.map(node => [node.id, node]));

  function toggle(id: string): void {
    setHidden(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
  function exportForTela(): void {
    try {
      downloadText('praeforma-domain-graph.tela', telaGraph(graph, hidden));
      setExportError('');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Tela 用に書き出せませんでした。');
    }
  }

  return <section className="panel" aria-label="ドメイン関係図">
    <h3>ドメイン関係図</h3>
    <p>実線：コアからビジネスへの所属　破線：親から子への関係。各ボックスから定義を開けます。</p>
    <label>表示倍率 <input type="range" min="0.5" max="1.5" step="0.1" value={scale} onChange={event => setScale(Number(event.target.value))} /> {Math.round(scale * 100)}%</label>
    {!graph.nodes.length ? <p>ドメインを登録すると関係図が表示されます。</p> : <>
      <div className="simple-actions" aria-label="分類の表示">
        {graph.groups.map(group => <button key={group.id} type="button" className={shown.has(group.id) ? 'primary' : 'ghost'}
          aria-pressed={shown.has(group.id)} onClick={() => toggle(group.id)}>
          {shown.has(group.id) ? 'ON' : 'OFF'} {group.name}
        </button>)}
      </div>
      <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
        <svg width={graph.width * scale} height={graph.height * scale} viewBox={`0 0 ${graph.width} ${graph.height}`}
          role="group" aria-label="ドメインの所属と親子関係">
          <defs><marker id={arrow} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#667085" /></marker></defs>
          {graph.groups.filter(group => shown.has(group.id)).map(group => {
            const first = graph.nodes.find(node => node.groupId === group.id);
            return first ? <text key={group.id} x={first.x} y={first.y - 30} fill="currentColor">{group.name}</text> : null;
          })}
          {graph.edges.filter(edge => shown.has(placed.get(edge.from)?.groupId ?? '') && shown.has(placed.get(edge.to)?.groupId ?? '')).map(edge =>
            <path key={edge.id} d={`M${edge.points.map(point => `${point.x},${point.y}`).join(' L')}`}
              fill="none" stroke="#667085" strokeWidth="2" strokeDasharray={edge.dashed ? '6 4' : undefined} markerEnd={`url(#${arrow})`}>
              <title>{placed.get(edge.from)?.label} → {placed.get(edge.to)?.label}</title>
            </path>)}
          {graph.nodes.filter(node => shown.has(node.groupId)).map(node => {
            const domain = domains.find(item => item.id === node.id);
            return <g key={node.id}>
              <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="8" fill="var(--panel)" stroke={colors.get(node.groupId)} strokeWidth="2" />
              <foreignObject x={node.x + 4} y={node.y + 4} width={node.width - 8} height={node.height - 8}>
                <button type="button" className="ghost" style={{ width: '100%', height: '100%', overflow: 'auto', overflowWrap: 'anywhere', whiteSpace: 'normal' }}
                  onClick={() => domain && onEdit(domain)} title={domain?.description ?? node.label}>{node.label}</button>
              </foreignObject>
            </g>;
          })}
        </svg>
      </div>
      <div className="simple-actions">
        <button type="button" onClick={exportForTela}>この関係図を Tela 用に書き出す</button>
      </div>
      {exportError ? <p role="alert" className="err-text">{exportError}</p> : null}
    </>}
  </section>;
}
