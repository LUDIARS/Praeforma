import React from 'react';
import { canvasFromRuntime, runtimeSnapshotSchema, type RuntimeSnapshot, type SceneSource } from '../../../../shared/scene-editor.ts';
import type { DesignCanvasDocument } from '../../../../shared/design-canvas.ts';
import type { ImageLayoutCandidate } from '../../lib/ux-design-api.ts';
import { sceneApi } from '../../lib/scene-editor-api.ts';
import { SceneDeviceSelect } from '../ux-design/FrameDeviceControls.tsx';

interface Props { pid:string;lid:string;disabled:boolean;onApply:(canvas:DesignCanvasDocument,source:SceneSource)=>void }
interface Proposal { image:string|null;runtime:RuntimeSnapshot|null;fingerprint:string|null;candidates:ImageLayoutCandidate[] }
const sample={version:1,source:'ゲームのメニュー',capturedAt:'2026-09-08T00:00:00Z',viewport:{width:1280,height:720},nodes:[{id:'start',parentId:null,label:'はじめる',kind:'button',bounds:{x:500,y:400,width:200,height:60},ontologyRef:'menu/start',sampleText:'はじめる'}]};
function readImage(file:File):Promise<string> {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('画像を読み込めませんでした。'));reader.readAsDataURL(file);
  });
}
export function SceneImport({pid,lid,disabled,onApply}:Props):React.ReactElement {
  const [file,setFile]=React.useState<File|null>(null);const [runtimeText,setRuntimeText]=React.useState('');
  const [device,setDevice]=React.useState<'unspecified'|'desktop'|'mobile'>('unspecified');
  const [proposal,setProposal]=React.useState<Proposal|null>(null);const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState('');
  const prepare=async()=>{
    setBusy(true);setError('');setProposal(null);
    try {
      let runtime:RuntimeSnapshot|null=null;
      if(runtimeText.trim()) {
        let input:unknown;try {input=JSON.parse(runtimeText);}catch {throw new Error('構造情報のJSONを確認してください。');}
        const parsed=runtimeSnapshotSchema.safeParse(input);if(!parsed.success) throw new Error('構造情報の形式・座標・親子関係を確認してください。');runtime=parsed.data;
      }
      if(file) {
        if(file.size>2*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('画像はPNG/JPEG/WebP、2MB以内で指定してください。');
        const image=await readImage(file);const result=await sceneApi.analyze(pid,lid,file,runtime);
        setProposal({image,runtime,...result});
      } else if(runtime) {
        const canvas=canvasFromRuntime(runtime,'observed');
        const frame=canvas.frames[0];if(!frame)throw new Error('画面を作成できませんでした。');
        setProposal({image:null,runtime,fingerprint:null,candidates:[{id:'observed',label:'観測した配置',confidence:1,frame,elements:canvas.elements,notes:['構造情報に記録された座標から配置しています。画像からの推測はありません。']}]});
      } else throw new Error('キャプチャか構造情報を指定してください。');
    } catch(e) {setError(e instanceof Error?e.message:'解析できませんでした。設定・権限・資料を確認してください。');} finally {setBusy(false);}
  };
  return <section className="panel scene-import"><h3>キャプチャ・構造情報から作る</h3>
    <fieldset disabled={disabled||busy}><SceneDeviceSelect value={device} onChange={setDevice} /><label className="simple-field"><span>ゲームのキャプチャ（2MB以内）</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{setFile(e.target.files?.[0]??null);setProposal(null);}} /></label>
    <label className="simple-field"><span>実行中のノード・オントロジー（JSON）</span><textarea rows={5} value={runtimeText} maxLength={600000} onChange={e=>{setRuntimeText(e.target.value);setProposal(null);}} /></label>
    <label className="simple-field"><span>構造情報ファイルを読み込む</span><input type="file" accept=".json,application/json" onChange={e=>{
      const selected=e.target.files?.[0];if(!selected)return;if(selected.size>600000){setError('構造情報は600KB以内で指定してください。');return;}
      void selected.text().then(text=>{setRuntimeText(text);setProposal(null);}).catch(()=>setError('構造情報を読み込めませんでした。'));
    }} /></label>
    <p className="meta">画像と構造情報を一緒に渡す場合は、同じ画面・同じ時点の資料を使ってください。解析時はAIに送信します。</p>
    <details><summary>構造情報の形式</summary><p>座標は画面左上を原点としたピクセルです。parentIdは親ノード、ontologyRefは対応する定義を示します。</p><pre>{JSON.stringify(sample,null,2)}</pre></details>
    <button type="button" onClick={()=>void prepare()} disabled={!file&&!runtimeText.trim()}>{busy?'解析中…':'パーツ候補を作る'}</button></fieldset>
    {error?<p role="alert" className="err-text">{error}</p>:null}
    {proposal?<div className="scene-candidates">{proposal.image?<img className="scene-reference" src={proposal.image} alt="解析元のキャプチャ"/>:null}{proposal.candidates.map(candidate=><article key={candidate.id}>
      <strong>{candidate.label}</strong><p>{candidate.elements.length} パーツ / {candidate.frame.width} × {candidate.frame.height}</p>
      <ul>{candidate.notes.map((note,index)=><li key={index}>{note}</li>)}</ul>
      <details><summary>取り込むパーツを確認</summary><ul>{candidate.elements.map(part=><li key={part.id}>{part.label}（{part.kind}）{part.dynamic?.source?` — 対応: ${part.dynamic.source}`:''}</li>)}</ul></details>
      <button disabled={disabled||busy} onClick={()=>{
        const frameId=crypto.randomUUID();const ids=new Map(candidate.elements.map((part,index)=>[part.id,`${frameId}-${index}`]));
        onApply({revision:0,frames:[{...candidate.frame,id:frameId,device}],elements:candidate.elements.map(part=>({...part,id:ids.get(part.id)!,frame_id:frameId,follow:part.follow?{...part.follow,target_element_id:ids.get(part.follow.target_element_id)!}:null})),transitions:[]},
          {id:crypto.randomUUID(),frameId,image:proposal.image,runtime:proposal.runtime,fingerprint:proposal.fingerprint,notes:candidate.notes});setProposal(null);
      }}>この候補を取り込む</button></article>)}</div>:null}
  </section>;
}
