import React from 'react';
import { useSearchParams } from 'react-router';
import { FragmentList } from './FragmentList.tsx';
import '../../styles/spec-workspace.css';

export function SpecWorkspace({ pid, children }: { pid: string; children: React.ReactNode }): React.ReactElement {
  const [search, setSearch] = useSearchParams();
  // Existing focused specification links continue to open the structured list.
  const structured = search.get('spec_kind') === 'structured' || !!search.get('focus');
  return <div className="panel spec-workspace">
    <h3>仕様</h3>
    <div className="simple-actions" aria-label="仕様の種類">
      {([['fragment', 'フラグメント'], ['structured', 'ストラクチャード']] as const).map(([kind, label]) =>
        <button key={kind} type="button" className={structured === (kind === 'structured') ? 'primary' : 'ghost'}
          aria-pressed={structured === (kind === 'structured')} onClick={() => setSearch((current) => {
            const next = new URLSearchParams(current); next.set('spec_kind', kind); next.delete('focus'); return next;
          })}>{label}</button>)}
    </div>
    {structured ? children : <FragmentList key={pid} pid={pid} />}
  </div>;
}
