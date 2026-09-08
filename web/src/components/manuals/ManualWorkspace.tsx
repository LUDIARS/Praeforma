import React,{useEffect,useRef,useState} from 'react';
import { manualApi,manualError,type ManualView } from '../../lib/manuals-api.ts';
import { ManualEditor } from './ManualEditor.tsx';
import { ManualSourceForm } from './ManualSourceForm.tsx';
import '../../styles/manuals.css';

export function ManualWorkspace({pid}:{pid:string}):React.ReactElement {
  const [items,setItems]=useState<Array<{id:string;title:string;published:boolean}>>([]);
  const [canEdit,setCanEdit]=useState(false);const [selected,setSelected]=useState('');
  const [manual,setManual]=useState<ManualView|null>(null);const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);const [dirty,setDirty]=useState(false);
  const [editorKey,setEditorKey]=useState(0);const root=useRef<HTMLDivElement>(null);
  const selection=useRef('');const alive=useRef(true);
  const newId=useRef(crypto.randomUUID());
  const refreshList=async():Promise<void>=>{let offset=0;const list=[];for(;;){const page=await manualApi.list(pid,offset);list.push(...page.items);if(alive.current)setCanEdit(page.canEdit);if(!page.hasMore)break;offset+=100;}if(alive.current)setItems(list);};
  useEffect(()=>{alive.current=true;void refreshList().catch(e=>setError(manualError(e))).finally(()=>setLoading(false));return()=>{alive.current=false;};},[pid]);
  useEffect(()=>{
    if(!dirty)return;
    const unload=(e:BeforeUnloadEvent):void=>{e.preventDefault();e.returnValue='';};
    const leave=(e:MouseEvent):void=>{const target=e.target as Element|null;if(root.current?.contains(target))return;if(target?.closest('a,button')&&!window.confirm('保存していない入力があります。この画面を離れますか？')){e.preventDefault();e.stopPropagation();}};
    window.addEventListener('beforeunload',unload);document.addEventListener('click',leave,true);
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',leave,true);};
  },[dirty]);
  const open=async(id:string):Promise<void>=>{
    selection.current=id;setSelected(id);setManual(null);setLoading(true);setError('');
    try{const d=await manualApi.get(pid,id);if(alive.current&&selection.current===id){setManual(d.manual);setCanEdit(d.canEdit);setEditorKey(k=>k+1);}}
    catch(e){if(selection.current===id)setError(manualError(e));}finally{if(selection.current===id)setLoading(false);}
  };
  const choose=(id:string):void=>{if(dirty&&!window.confirm('保存していない入力を破棄して切り替えますか？'))return;setDirty(false);if(id==='new'){newId.current=crypto.randomUUID();selection.current=id;setSelected(id);setManual(null);}else void open(id);};
  return <div ref={root} className="manual-workspace">
    <h3>機能説明書</h3>
    <div className="manual-layout"><aside aria-label="説明書一覧">
      {canEdit&&<button type="button" onClick={()=>choose('new')}>説明書を作る</button>}
      {items.map(item=><button type="button" key={item.id} aria-pressed={selected===item.id} onClick={()=>choose(item.id)}>{item.title}{!item.published?'（作成案）':''}</button>)}
      {!loading&&!items.length&&!error&&<p>まだ説明書はありません。</p>}
      <button type="button" onClick={()=>{setError('');void refreshList().catch(e=>setError(manualError(e)));}}>一覧を更新</button>
    </aside><div className="manual-content">
      {error&&<p role="alert">{error}</p>}{loading&&<p role="status">読み込み中…</p>}
      {selected==='new'&&canEdit&&<div onChange={()=>setDirty(true)}><ManualSourceForm key={newId.current} pid={pid} onGenerate={async(specId,implementation)=>{
        const id=newId.current;setDirty(true);
        const result=await manualApi.generate(pid,{id,expectedRevision:0,specId,implementation});
        await refreshList();if(alive.current&&selection.current==='new'){setDirty(false);await open(result.id);}
      }}/></div>}
      {manual&&<ManualEditor key={`${manual.id}:${editorKey}`} pid={pid} manual={manual} canEdit={canEdit}
        onDirty={value=>{if(selection.current===manual.id)setDirty(value);}}
        onReload={async()=>{const d=await manualApi.get(pid,manual.id);if(alive.current&&selection.current===manual.id){setManual(d.manual);setEditorKey(k=>k+1);}await refreshList();}}/>}
      {!selected&&!loading&&items.length>0&&<p>読みたい説明書を選んでください。</p>}
    </div></div>
  </div>;
}
