import React from 'react';
import type { ManualDocument } from '../../../../shared/feature-manual.ts';

/** Text-only rendering prevents model-provided executable markup. PF-MANUAL-2/5. */
export function ManualReader({document:d}:{document:ManualDocument}):React.ReactElement {
  return <article className="manual-reader">
    <h2>{d.title}</h2><p>{d.purpose}</p>
    {d.sections.map((section,i)=><section key={i}><h3>{section.heading}</h3><p>{section.text}</p></section>)}
    <figure aria-label={d.diagram.caption} className="manual-diagram">
      <figcaption>{d.diagram.caption}</figcaption>
      <ol>{d.diagram.steps.map((step,i)=><li key={i}>
        <div className="manual-step"><span className="manual-step-number" aria-hidden="true">{i+1}</span>{step.label}</div>
        {step.branches.length>0&&<ul className="manual-branches">{step.branches.map((b,j)=><li key={j}><strong>{b.condition}</strong><span aria-hidden="true"> → </span>{b.result}</li>)}</ul>}
        {i<d.diagram.steps.length-1&&<span className="manual-arrow" aria-hidden="true">↓</span>}
      </li>)}</ol>
    </figure>
  </article>;
}
