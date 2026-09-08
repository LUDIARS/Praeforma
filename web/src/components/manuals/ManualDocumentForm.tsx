import React from 'react';
import { manualLanguageIssues, type ManualDocument } from '../../../../shared/feature-manual.ts';

export function ManualDocumentForm({document:d,onChange}:{document:ManualDocument;onChange:(d:ManualDocument)=>void}):React.ReactElement {
  const change=(work:(copy:ManualDocument)=>void):void=>{const copy=structuredClone(d);work(copy);onChange(copy);};
  return <div className="manual-form">
    <label>説明書の名前<input value={d.title} maxLength={100} onChange={e=>change(c=>{c.title=e.target.value;})}/></label>
    <label>できること<textarea value={d.purpose} maxLength={1200} onChange={e=>change(c=>{c.purpose=e.target.value;})}/></label>
    {d.sections.map((s,i)=><fieldset key={i}><legend>説明 {i+1}</legend>
      <label>見出し<input value={s.heading} maxLength={100} onChange={e=>change(c=>{c.sections[i]!.heading=e.target.value;})}/></label>
      <label>説明<textarea value={s.text} maxLength={1200} onChange={e=>change(c=>{c.sections[i]!.text=e.target.value;})}/></label>
      <button type="button" disabled={d.sections.length<=1} onClick={()=>change(c=>{c.sections.splice(i,1);})}>この説明を削除</button>
    </fieldset>)}
    <button type="button" disabled={d.sections.length>=12} onClick={()=>change(c=>{c.sections.push({heading:'',text:''});})}>説明を追加</button>
    <label>図の説明<input value={d.diagram.caption} maxLength={300} onChange={e=>change(c=>{c.diagram.caption=e.target.value;})}/></label>
    {d.diagram.steps.map((s,i)=><fieldset key={i}><legend>図の段階 {i+1}</legend>
      <label>操作や結果<input value={s.label} maxLength={200} onChange={e=>change(c=>{c.diagram.steps[i]!.label=e.target.value;})}/></label>
      {s.branches.map((b,j)=><div key={j}><label>条件<input value={b.condition} maxLength={150} onChange={e=>change(c=>{c.diagram.steps[i]!.branches[j]!.condition=e.target.value;})}/></label>
        <label>その時の結果<input value={b.result} maxLength={250} onChange={e=>change(c=>{c.diagram.steps[i]!.branches[j]!.result=e.target.value;})}/></label>
        <button type="button" onClick={()=>change(c=>{c.diagram.steps[i]!.branches.splice(j,1);})}>条件を削除</button></div>)}
      <button type="button" disabled={s.branches.length>=4} onClick={()=>change(c=>{c.diagram.steps[i]!.branches.push({condition:'',result:''});})}>条件を追加</button>
      <button type="button" disabled={d.diagram.steps.length<=2} onClick={()=>change(c=>{c.diagram.steps.splice(i,1);})}>段階を削除</button>
    </fieldset>)}
    <button type="button" disabled={d.diagram.steps.length>=12} onClick={()=>change(c=>{c.diagram.steps.push({label:'',branches:[]});})}>段階を追加</button>
    {manualLanguageIssues(d).map(issue=><p role="alert" key={issue}>{issue}</p>)}
  </div>;
}
