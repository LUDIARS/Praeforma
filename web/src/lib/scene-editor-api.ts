import { req } from './api.ts';
import type { SceneDocument, RuntimeSnapshot } from '../../../shared/scene-editor.ts';
import type { ImageLayoutCandidate } from './ux-design-api.ts';
const root=(pid:string,lid:string)=>`/api/projects/${pid}/layouts/${lid}/scene-editor`;
export const sceneApi={
  get:(pid:string,lid:string)=>req<{ document:SceneDocument;name:string;canEdit:boolean }>(root(pid,lid)),
  save:(pid:string,lid:string,document:SceneDocument)=>{
    const { revision, ...canvas }=document.canvas;
    return req<{document:SceneDocument}>(root(pid,lid),{method:'PUT',body:JSON.stringify({canvas:{...canvas,expected_revision:revision},sources:document.sources,web:document.web})});
  },
  analyze:(pid:string,lid:string,image:File,runtime:RuntimeSnapshot|null)=>{
    const body=new FormData(); body.set('image',image); if(runtime) body.set('runtime',JSON.stringify(runtime));
    return req<{fingerprint:string;candidates:ImageLayoutCandidate[]}>(`${root(pid,lid)}/analyze`,{method:'POST',body});
  },
};
