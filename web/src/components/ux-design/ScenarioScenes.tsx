import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.ts';
import { sceneApi } from '../../lib/scene-editor-api.ts';
import type { UxCanvasDocument } from '../../lib/ux-design-api.ts';
import { sceneQueryKey, useSceneLayerSources } from '../scene-editor/useSceneLayerSources.ts';

export function scenarioLayers(canvas: UxCanvasDocument) {
  return canvas.frames.flatMap(frame => frame.scene_ref ? [{ id: frame.id, frameId: frame.id,
    layoutId: frame.scene_ref.layout_id, layoutFrameId: frame.scene_ref.frame_id }] : []);
}

interface Props { projectId: string; canvas: UxCanvasDocument; onChange: (canvas: UxCanvasDocument) => void; disabled: boolean }

/** Frames reference the scene; only extra parts belong to the scenario. */
export function ScenarioScenes({ projectId, canvas, onChange, disabled }: Props): React.ReactElement {
  const [layoutId, setLayoutId] = React.useState('');
  const [frameId, setFrameId] = React.useState('');
  const [targetId, setTargetId] = React.useState('');
  const layouts = useQuery({ queryKey: ['layouts', projectId], queryFn: () => api.listLayouts(projectId) });
  const scene = useQuery({ queryKey: sceneQueryKey(projectId, layoutId), queryFn: () => sceneApi.get(projectId, layoutId), enabled: !!layoutId });
  const sources = useSceneLayerSources(projectId, scenarioLayers(canvas));
  const selected = scene.data?.document.canvas.frames.find(frame => frame.id === frameId);
  return <fieldset className="foundation-form" disabled={disabled}>
    <legend>基本構成はシーン、追加パーツはこのシナリオ</legend>
    <p>シーンを選んで画面を追加し、下のキャンバスで追加パーツを配置します。ゲームプレイでは画面を選び「この画面から遷移を接続」で流れを設定できます。</p>
    <label className="simple-field"><span>シーン</span><select value={layoutId} onChange={event => { setLayoutId(event.target.value); setFrameId(''); }}><option value="">選択してください</option>{layouts.data?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="simple-field"><span>基本の画面</span><select value={frameId} onChange={event => setFrameId(event.target.value)}><option value="">選択してください</option>{scene.data?.document.canvas.frames.map(frame => <option key={frame.id} value={frame.id}>{frame.name}</option>)}</select></label>
    <label className="simple-field"><span>関連付け先</span><select value={targetId} onChange={event => setTargetId(event.target.value)}><option value="">新しい画面として追加</option>{canvas.frames.map(frame => <option key={frame.id} value={frame.id}>{frame.name}</option>)}</select></label>
    <button type="button" disabled={!selected || (!targetId && canvas.frames.length >= 200)} onClick={() => {
      if (!selected) return;
      const scene_ref = { layout_id: layoutId, frame_id: selected.id, revision: scene.data?.document.canvas.revision ?? 0 };
      if (targetId) onChange({ ...canvas, frames: canvas.frames.map(frame => frame.id === targetId ? { ...frame, scene_ref } : frame) });
      else onChange({ ...canvas, frames: [...canvas.frames, { ...selected, id: crypto.randomUUID(), description: '', states: [], scene_ref,
        x: Math.min(99000, Math.max(0, ...canvas.frames.map(frame => frame.x + frame.width)) + 80), y: 70 }] });
    }}>{targetId ? 'この画面の基本シーンを設定' : 'シーンから画面を追加'}</button>
    {layouts.isError || scene.isError ? <p role="alert">シーンを取得できませんでした。</p> : null}
    <ul>{canvas.frames.map(frame => {
      const ref = frame.scene_ref;
      const source = ref ? sources.get(ref.layout_id) : null;
      const base = source?.document?.canvas.frames.find(item => item.id === ref?.frame_id);
      const needsRefresh = ref && source?.document && ref.revision !== source.document.canvas.revision;
      return <li key={frame.id}>{frame.name}: {ref ? <><Link to={`/projects/${projectId}/layouts/${ref.layout_id}`}>基本シーンを編集</Link> {source?.isLoading ? '読み込み中…' : base ? `／${base.name}` : '参照先を表示できません'}{needsRefresh ? <><span> 基本構成が更新されています</span><button type="button" onClick={() => onChange({ ...canvas, frames: canvas.frames.map(item => item.id === frame.id ? { ...item, scene_ref: { ...ref, revision: source.document!.canvas.revision } } : item) })}>現在のシーン版を採用</button></> : null}<button type="button" onClick={() => onChange({ ...canvas, frames: canvas.frames.map(item => { if (item.id !== frame.id) return item; const { scene_ref: unused, ...unbound } = item; return unbound; }) })}>関連付けを外す</button></> : 'シーン未設定'}</li>;
    })}</ul>
  </fieldset>;
}
