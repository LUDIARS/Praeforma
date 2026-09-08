import React,{useEffect,useState} from 'react';
import type { ManualDocument,ManualSource } from '../../../../shared/feature-manual.ts';
import { manualApi,manualError,type ManualView } from '../../lib/manuals-api.ts';
import { ManualReader } from './ManualReader.tsx';
import { ManualDocumentForm } from './ManualDocumentForm.tsx';
import { ManualSourceForm } from './ManualSourceForm.tsx';
import { readManualDraft,writeManualDraft,clearManualDraft } from '../../lib/manual-drafts.ts';

export function ManualEditor({pid,manual,canEdit,onReload,onDirty}:{pid:string;manual:ManualView;canEdit:boolean;onReload:()=>Promise<void>;onDirty:(dirty:boolean)=>void}):React.ReactElement {
  const restored=canEdit?readManualDraft(pid,manual.id):undefined;
  const [editing,setEditing]=useState<ManualDocument|null>(restored?.document??null);
  const [basis,setBasis]=useState<'saved'|'proposal'>(restored?.basis??'saved');
  const [draftRevision,setDraftRevision]=useState(restored?.revision??manual.revision);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [showSource,setShowSource]=useState(false);
  useEffect(()=>{if(editing){writeManualDraft(pid,manual.id,{document:editing,basis,revision:draftRevision});onDirty(true);}},[editing,basis,draftRevision,pid,manual.id]);
  const begin=(d:ManualDocument,origin:'saved'|'proposal'):void=>{setEditing(structuredClone(d));setBasis(origin);setDraftRevision(manual.revision);onDirty(true);};
  const generate=async(specId:string,implementation:ManualSource['implementation']):Promise<void>=>{
    setBusy(true);onDirty(true);
    try{await manualApi.generate(pid,{id:manual.id,expectedRevision:manual.revision,specId,implementation});await onReload();onDirty(false);}
    finally{setBusy(false);}
  };
  return <div>
    {manual.freshness!=='current'&&<p role="status">{manual.freshness==='outdated'?'元の資料が変わっています。説明書の更新が必要です。':'元の資料を確認できません。説明が現在の動きと異なる場合があります。'}</p>}
    <p className="muted">動きが変わった場合は、説明書の作成者による確認が必要です。</p>
    {manual.document?<ManualReader document={manual.document}/>:<p>まだ保存された説明書はありません。作成案を確認してください。</p>}
    {canEdit&&<fieldset disabled={busy} className="manual-edit-tools"><legend>説明書の編集</legend>
      {!editing&&<div className="simple-actions">
        {manual.document&&<button type="button" onClick={()=>begin(manual.document!,'saved')}>保存した説明を修正</button>}
        {manual.proposal&&<button type="button" onClick={()=>begin(manual.proposal!,'proposal')}>作成案を確認・調整</button>}
        <button type="button" onClick={()=>setShowSource(s=>!s)}>資料から作り直す</button>
      </div>}
      {editing&&<>
        {draftRevision!==manual.revision&&<p role="alert">以前の修正を復元しました。保存済みの内容が変わっているため、そのまま上書きできません。必要な文章を控えてから修正をやり直してください。</p>}
        <p>{basis==='proposal'?'作成案です。保存済みの説明は上に残っています。':'保存済みの説明を修正しています。'}</p>
        <ManualDocumentForm document={editing} onChange={setEditing}/>
        <h3>表示の確認</h3><ManualReader document={editing}/>
        <button type="button" disabled={draftRevision!==manual.revision} onClick={()=>{
          setBusy(true);setError('');void manualApi.save(pid,manual.id,editing,basis,draftRevision).then(async()=>{clearManualDraft(pid,manual.id);setEditing(null);onDirty(false);await onReload();}).catch(e=>setError(manualError(e))).finally(()=>setBusy(false));
        }}>内容を確認して保存</button>
        <button type="button" onClick={()=>{if(window.confirm('保存していない修正を破棄しますか？')){clearManualDraft(pid,manual.id);setEditing(null);onDirty(false);}}}>修正を破棄</button>
      </>}
      {showSource&&!editing&&manual.source&&<div onChange={()=>onDirty(true)}><ManualSourceForm pid={pid} initial={manual.source} onGenerate={generate}/></div>}
      <details><summary>執筆の根拠</summary><p>仕様と実装資料を読み、専用の執筆規則で作成しています。実機での動作確認を示すものではありません。</p>
        <p>出所：{manual.source?.implementation.reference} ／ 版：{manual.source?.implementation.version}</p>
        <p>最終保存：{manual.updatedAt}</p>
      </details>
    </fieldset>}{error&&<p role="alert">{error}</p>}
  </div>;
}
