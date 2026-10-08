import React from 'react';
import type { Spec } from '../../lib/api.ts';

/** ストラクチャード仕様をブロック単位で並べる。 概要だけ見せ、 本文と条件は開いたときに出す。 */
export function StructuredSpecList({ specs, focus }: { specs: Spec[]; focus: string | null }): React.ReactElement {
  return <div className="spec-block-list">
    {specs.map((spec) => <details key={spec.id} className="fragment-card" data-focus={spec.code} open={spec.code === focus || undefined}>
      <summary className="spec-block-summary">
        <span className="spec-block-title">{spec.code} — {spec.title}</span>
        <span className="fragment-meta"><span className="role-badge">{spec.status}</span><span>{spec.priority}</span></span>
      </summary>
      <div className="fragment-meta"><span>カテゴリ: {spec.category}</span><span>v{spec.version}</span></div>
      {spec.description ? <p className="fragment-content">{spec.description}</p> : <p className="meta">説明はありません。</p>}
      <Conditions label="前提条件" items={spec.preconditions} />
      <Conditions label="事後条件" items={spec.postconditions} />
    </details>)}
  </div>;
}

function Conditions({ label, items }: { label: string; items: string[] }): React.ReactElement | null {
  if (!items.length) return null;
  return <><strong>{label}</strong><ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul></>;
}
