import React from 'react';
import { useSearchParams } from 'react-router';
import { FragmentList } from './FragmentList.tsx';
import { ManualWorkspace } from '../manuals/ManualWorkspace.tsx';
import { SpecVersionPanel } from './SpecVersionPanel.tsx';
import '../../styles/spec-workspace.css';

export function SpecWorkspace({ pid, children }: { pid: string; children: React.ReactNode }): React.ReactElement {
  const [search, setSearch] = useSearchParams();
  // Existing focused specification links continue to open the structured list.
  const structured = search.get('spec_kind') === 'structured' || !!search.get('focus');
  const manual = search.get('spec_kind') === 'manual' && !search.get('focus');
  return <div className="panel spec-workspace">
    <h3>仕様</h3>
    <details open={search.get('reconstruct') === '1' || undefined}><summary><strong>再構築</strong>・バージョンログ</summary><SpecVersionPanel key={pid} pid={pid}/></details>
    <div className="simple-actions" aria-label="仕様の種類">
      {([['fragment', '断片'], ['structured', '体系'], ['manual', '説明書']] as const).map(([kind, label]) =>
        <button key={kind} type="button" className={(manual ? kind === 'manual' : structured ? kind === 'structured' : kind === 'fragment') ? 'primary' : 'ghost'}
          aria-pressed={manual ? kind === 'manual' : structured ? kind === 'structured' : kind === 'fragment'} onClick={() => setSearch((current) => {
            const next = new URLSearchParams(current); next.set('spec_kind', kind); next.delete('focus'); return next;
          })}>{label}</button>)}
    </div>
    {manual ? <ManualWorkspace key={pid} pid={pid} /> : structured ? children : <FragmentList key={pid} pid={pid} />}
  </div>;
}
