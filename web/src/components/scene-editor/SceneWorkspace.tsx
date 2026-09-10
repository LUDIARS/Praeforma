import React from 'react';
import { useMutation } from '@tanstack/react-query';
import type { SceneDocument, SceneSource } from '../../../../shared/scene-editor.ts';
import { DesignCanvas } from '../ux-design/DesignCanvas.tsx';
import { useCanvasHistory } from '../ux-design/useCanvasHistory.ts';
import { sceneApi } from '../../lib/scene-editor-api.ts';
import { SceneImport } from './SceneImport.tsx';
import { WebSceneEditor } from './WebSceneEditor.tsx';
import { emptyWebScene, useWebSceneHistory } from './useWebSceneHistory.ts';

/** server 側 bodyLimit (8MiB) と sources 上限 (20件) に余裕を見た取り込み上限。 */
const MAX_REFERENCE_BYTES=6*1024*1024;
const MAX_SOURCES=20;

export function SceneWorkspace({pid,lid,initial,canEdit}:{pid:string;lid:string;initial:SceneDocument;canEdit:boolean}):React.ReactElement {
  const history=useCanvasHistory(initial.canvas);const [sources,setSources]=React.useState<SceneSource[]>(initial.sources);
  const web=useWebSceneHistory(initial.web);
  const [saved,setSaved]=React.useState(JSON.stringify({canvas:initial.canvas,sources:initial.sources,web:initial.web??emptyWebScene}));const [showImport,setShowImport]=React.useState(false);
  const [showReferences,setShowReferences]=React.useState(true);const [importError,setImportError]=React.useState('');
  const dirty=JSON.stringify({canvas:history.canvas,sources,web:web.value})!==saved;
  React.useEffect(()=>{
    if(!dirty)return;
    const prevent=(event:BeforeUnloadEvent)=>event.preventDefault();
    const navigate=(event:MouseEvent)=>{
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const link=event.target instanceof Element?event.target.closest('a[href]'):null;
      if(link instanceof HTMLAnchorElement&&link.target!=='_blank'&&!link.hasAttribute('download')&&link.href!==window.location.href&&!window.confirm('未保存の編集があります。保存せずに画面を移動しますか？')){event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener('beforeunload',prevent);document.addEventListener('click',navigate,true);
    return()=>{window.removeEventListener('beforeunload',prevent);document.removeEventListener('click',navigate,true);};
  },[dirty]);
  const save=useMutation({mutationFn:()=>sceneApi.save(pid,lid,{canvas:history.canvas,sources:sources.filter(source=>history.canvas.frames.some(frame=>frame.id===source.frameId)),web:{...web.value,variants:web.value.variants.filter(variant=>history.canvas.frames.some(frame=>frame.id===variant.frameId))}}),
    onSuccess:({document})=>{history.reset(document.canvas);setSources(document.sources);web.reset(document.web??emptyWebScene);setSaved(JSON.stringify({canvas:document.canvas,sources:document.sources,web:document.web??emptyWebScene}));}});
  return <div className="scene-workspace">
    <div className="scene-heading"><span>{dirty?'未保存の変更があります':history.canvas.revision===0?'既存の配置を表示しています。保存するとシーン設計として記録します。':'保存済みの画面を表示しています'}</span><label><input type="checkbox" checked={showReferences} onChange={e=>setShowReferences(e.target.checked)}/>元画像を重ねる</label><button type="button" className="ghost" disabled={!canEdit||save.isPending} onClick={()=>setShowImport(!showImport)}>キャプチャ・ノードを取り込む</button></div>
    {save.error?<p role="alert" className="err-text">保存できませんでした。権限・入力内容を確認してください。他の変更と競合した場合は、編集内容を控えてから開き直してください。</p>:null}
    {importError?<p role="alert" className="err-text">{importError}</p>:null}
    {showImport?<SceneImport pid={pid} lid={lid} disabled={!canEdit||save.isPending} onApply={(canvas,source)=>{
      // 保存要求は 8MiB 上限。 取り込み時点で超過を知らせ、 保存時に編集ごと失うのを避ける。
      const total=[...sources,source].reduce((sum,item)=>sum+(item.image?.length??0),0);
      if(total>MAX_REFERENCE_BYTES||sources.length>=MAX_SOURCES) {
        setImportError('取り込み済みの資料が多すぎます。不要な画面を削除してから取り込み直してください。');return;
      }
      setImportError('');
      const offset=Math.max(0,...history.canvas.frames.map(frame=>frame.x+frame.width))+80;
      history.replace({...history.canvas,frames:[...history.canvas.frames,...canvas.frames.map(frame=>({...frame,x:offset,y:70}))],elements:[...history.canvas.elements,...canvas.elements]});
      setSources(current=>[...current,source]);
    }}/>:null}
    <DesignCanvas showLayers referenceImages={showReferences?Object.fromEntries(sources.filter(source=>source.image).map(source=>[source.frameId,source.image!])):undefined} canvas={history.canvas} onChange={history.replace} onPreview={history.preview} onCancelPreview={history.cancelPreview} onUndo={history.undo} onRedo={history.redo} canUndo={history.canUndo} canRedo={history.canRedo} onSave={()=>save.mutate()} isSaving={save.isPending} isReadOnly={!canEdit||save.isPending} />
    <details className="panel"><summary>取り込んだ資料と対応するノード</summary>{sources.filter(source=>history.canvas.frames.some(frame=>frame.id===source.frameId)).map(source=><article key={source.id}>
      <h3>{history.canvas.frames.find(frame=>frame.id===source.frameId)?.name}</h3>
      {source.image?<img className="scene-reference" src={source.image} alt="採用したキャプチャ"/>:null}<p className="meta">{source.fingerprint}</p>
      {source.runtime?<><p>{source.runtime.source} / {source.runtime.capturedAt}</p><ul>{source.runtime.nodes.map(node=><li key={node.id}>{node.label} — {node.id}{node.parentId?` / 親: ${node.parentId}`:''}{node.ontologyRef?` / 定義: ${node.ontologyRef}`:''}</li>)}</ul></>:null}
      <ul>{source.notes.map((note,index)=><li key={index}>{note}</li>)}</ul>
    </article>)}</details>
    <WebSceneEditor canvas={history.canvas} value={web.value} onChange={web.change} disabled={!canEdit||save.isPending} onUndo={web.undo} onRedo={web.redo} canUndo={web.canUndo} canRedo={web.canRedo} />
  </div>;
}
