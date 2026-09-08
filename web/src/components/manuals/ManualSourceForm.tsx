import React,{useEffect,useState} from 'react';
import type { ManualSource } from '../../../../shared/feature-manual.ts';
import { manualApi,manualError } from '../../lib/manuals-api.ts';

export function ManualSourceForm({pid,initial,onGenerate}:{pid:string;initial?:ManualSource;onGenerate:(specId:string,implementation:ManualSource['implementation'])=>Promise<void>}):React.ReactElement {
  const [sources,setSources]=useState<Array<{id:string;title:string}>>([]);
  const [specId,setSpecId]=useState(initial?.specId??'');
  const [implementation,setImplementation]=useState(initial?.implementation??{reference:'',version:'',content:''});
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{let active=true;void(async()=>{try{const items=[];for(const kind of ['spec','fragment']){let offset=0;for(;;){const page=await manualApi.sources(pid,offset,kind);items.push(...page.items);if(!page.hasMore)break;offset+=100;}}if(active)setSources(items);}catch(e){if(active)setError(manualError(e));}})();return()=>{active=false;};},[pid]);
  return <form className="manual-form" onSubmit={e=>{e.preventDefault();setBusy(true);setError('');void onGenerate(specId,implementation).catch(e=>setError(manualError(e))).finally(()=>setBusy(false));}}>
    <fieldset disabled={busy}><legend>説明の元になる資料</legend>
      <label>仕様<select required value={specId} onChange={e=>setSpecId(e.target.value)}><option value="">選んでください</option>{sources.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <label>実装資料の出所<input required maxLength={300} value={implementation.reference} onChange={e=>setImplementation({...implementation,reference:e.target.value})} placeholder="対象の製品と資料名"/></label>
      <label>実装資料の版<input required maxLength={200} value={implementation.version} onChange={e=>setImplementation({...implementation,version:e.target.value})} placeholder="変更を特定できる版"/></label>
      <label>実装資料を読み込む<input type="file" multiple accept=".ts,.tsx,.js,.jsx,.cpp,.h,.cs,.py,.md,.txt" onChange={e=>{
        const files=Array.from(e.target.files??[]);void(async()=>{try{if(files.reduce((n,f)=>n+f.size,0)>240000)throw Error();const contents=await Promise.all(files.map(async f=>`--- ${f.name} ---\n${await f.text()}`));const content=contents.join('\n');if(content.length>80000)throw Error();setImplementation(current=>({...current,content}));setError('');}catch{setError('資料が大きすぎるか、読み込めませんでした。関連する部分だけを選んでください。');}})();
      }}/></label>
      <label>実装資料の内容<textarea required minLength={20} maxLength={80000} rows={8} value={implementation.content} onChange={e=>setImplementation({...implementation,content:e.target.value})}/></label>
      <p>説明したい操作と、その結果や条件がわかる範囲を読み込んでください。個人情報や秘密の値は含めないでください。</p>
      <p>実装資料の変更は自動取得しません。実装を更新したら、資料と版を読み込み直してください。</p>
      <button type="submit" disabled={!sources.length}>{busy?'説明書を作成中…':'AIで説明書の案を作る'}</button>
    </fieldset>{error&&<p role="alert">{error}</p>}
  </form>;
}
