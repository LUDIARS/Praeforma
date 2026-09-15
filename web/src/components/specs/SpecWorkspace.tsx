import React from 'react';
import { useSearchParams } from 'react-router';
import { FragmentList } from './FragmentList.tsx';
import { ManualWorkspace } from '../manuals/ManualWorkspace.tsx';
import { SpecVersionPanel } from './SpecVersionPanel.tsx';
import { SpecVisualizationView } from './SpecVisualizationView.tsx';
import '../../styles/spec-workspace.css';

const SPEC_KINDS = [['fragment', '断片'], ['structured', '体系'], ['manual', '説明書'], ['view', '可視化']] as const;

export function SpecWorkspace({ pid, children }: { pid: string; children: React.ReactNode }): React.ReactElement {
  const [search, setSearch] = useSearchParams();
  // Existing focused specification links continue to open the structured list.
  const focused = !!search.get('focus');
  const requested = search.get('spec_kind');
  const kind = focused ? 'structured' : SPEC_KINDS.find(([id]) => id === requested)?.[0] ?? 'fragment';
  return <div className="panel spec-workspace">
    <h3>仕様</h3>
    <details open={search.get('reconstruct') === '1' || undefined}><summary><strong>再構築</strong>・バージョンログ</summary><SpecVersionPanel key={pid} pid={pid}/></details>
    <div className="simple-actions" aria-label="仕様の種類">
      {SPEC_KINDS.map(([id, label]) =>
        <button key={id} type="button" className={kind === id ? 'primary' : 'ghost'}
          aria-pressed={kind === id} onClick={() => setSearch((current) => {
            const next = new URLSearchParams(current); next.set('spec_kind', id); next.delete('focus'); return next;
          })}>{label}</button>)}
    </div>
    {kind === 'view' ? <SpecVisualizationView key={pid} pid={pid} />
      : kind === 'manual' ? <ManualWorkspace key={pid} pid={pid} />
      : kind === 'structured' ? children : <FragmentList key={pid} pid={pid} />}
  </div>;
}
