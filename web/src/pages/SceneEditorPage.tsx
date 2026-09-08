import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { sceneApi } from '../lib/scene-editor-api.ts';
import { SceneWorkspace } from '../components/scene-editor/SceneWorkspace.tsx';
import { LayoutEditorPage } from './LayoutEditorPage.tsx';
import '../styles/ux-design.css';
import '../styles/scene-editor.css';

export function SceneEditorPage():React.ReactElement {
  const {pid,lid}=useParams();const [search]=useSearchParams();
  const query=useQuery({queryKey:['scene-editor',pid,lid],queryFn:()=>sceneApi.get(pid!,lid!),enabled:!!pid&&!!lid&&search.get('editor')!=='legacy',refetchOnWindowFocus:false});
  if(search.get('editor')==='legacy')return <><Link to="?">統合シーンエディタに戻る</Link><LayoutEditorPage/></>;
  return <><div className="scene-heading"><h2>{query.data?.name??'シーン'} — シーンエディタ</h2><Link to="?editor=legacy">旧2D・3Dエディタ</Link></div>
    {query.isPending?<p>読み込み中…</p>:query.error?<p role="alert">シーンを読み込めませんでした。</p>:query.data&&pid&&lid?<SceneWorkspace key={`${pid}/${lid}`} pid={pid} lid={lid} initial={query.data.document} canEdit={query.data.canEdit}/>:null}
  </>;
}
