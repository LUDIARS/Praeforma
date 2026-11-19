import React from 'react';
import type { Spec } from '../../lib/api.ts';
import { SPEC_CATEGORY_GROUPS } from '../../../../shared/spec-view.ts';
import { StructuredSpecList } from './StructuredSpecList.tsx';

const KNOWN = new Set(SPEC_CATEGORY_GROUPS.map(([id]) => id));

/**
 * 体系仕様をカテゴリごとに分け、いまの版を出す (PF-HOME-9)。
 * 廃止した仕様はカテゴリごとの閉じたトグルに入れる。focus の仕様が廃止なら、そのトグルを開く。
 */
export function CategorizedSpecList({ pid, specs, focus }: { pid: string; specs: Spec[]; focus: string | null }): React.ReactElement {
  const groups = SPEC_CATEGORY_GROUPS.map(([id, label]) => {
    const items = specs.filter((spec) => (KNOWN.has(spec.category) ? spec.category : 'other') === id)
      .sort((a, b) => a.code.localeCompare(b.code, 'ja'));
    return { id, label, current: items.filter((spec) => spec.status !== 'obsolete'), obsolete: items.filter((spec) => spec.status === 'obsolete') };
  }).filter((group) => group.current.length + group.obsolete.length > 0);
  return <div className="spec-category-list">
    {groups.map((group) => <section key={group.id} className="spec-category" aria-labelledby={`spec-category-${group.id}`}>
      <h4 id={`spec-category-${group.id}`}>{group.label} <span className="meta">({group.current.length})</span></h4>
      {group.current.length ? <StructuredSpecList pid={pid} specs={group.current} focus={focus} />
        : <p className="meta">いまの版の仕様はありません。</p>}
      {group.obsolete.length > 0 && <details className="fragment-toggle" data-state="obsolete"
        open={group.obsolete.some((spec) => spec.code === focus) || undefined}>
        <summary>廃止した仕様 ({group.obsolete.length})</summary>
        <StructuredSpecList pid={pid} specs={group.obsolete} focus={focus} />
      </details>}
    </section>)}
  </div>;
}
