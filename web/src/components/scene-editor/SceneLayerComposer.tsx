import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.ts';
import { sceneApi } from '../../lib/scene-editor-api.ts';
import type { DesignCanvasDocument } from '../../../../shared/design-canvas.ts';
import { MAX_LAYERS_PER_FRAME, type SceneLayer } from '../../../../shared/scene-layers.ts';
import { deviceLabels } from '../ux-design/FrameDeviceControls.tsx';
import { sceneQueryKey, type LayerSceneSource } from './useSceneLayerSources.ts';

type Frame = DesignCanvasDocument['frames'][number];

interface Props {
  pid: string;
  lid: string;
  frameId: string;
  layers: readonly SceneLayer[];
  sources: ReadonlyMap<string, LayerSceneSource>;
  disabled: boolean;
  onChange: (layers: SceneLayer[]) => void;
}

const frameLabel = (frame: Frame): string => `${frame.name} / ${deviceLabels[frame.device ?? 'unspecified']}`;

function layerLabel(layer: SceneLayer, source: LayerSceneSource | undefined): string {
  if (!source || source.isLoading) return '読み込み中…';
  const frame = source.document?.canvas.frames.find(item => item.id === layer.layoutFrameId);
  return `${source.name ?? '参照先なし'} / ${frame ? frameLabel(frame) : '画面なし'}`;
}

/** Edits which scenes are stacked over one frame, bottom to top. The result is saved with the scene. PF-SCENE-8. */
export function SceneLayerComposer({ pid, lid, frameId, layers, sources, disabled, onChange }: Props): React.ReactElement {
  const [layoutId, setLayoutId] = React.useState('');
  const [layoutFrameId, setLayoutFrameId] = React.useState('');
  const scenes = useQuery({ queryKey: ['layouts', pid], queryFn: () => api.listLayouts(pid), refetchOnWindowFocus: false });
  const candidate = useQuery({
    queryKey: sceneQueryKey(pid, layoutId), queryFn: () => sceneApi.get(pid, layoutId),
    enabled: !!layoutId, retry: false, refetchOnWindowFocus: false,
  });
  const candidateFrames = candidate.data?.document.canvas.frames ?? [];
  const isDuplicate = layers.some(layer => layer.layoutId === layoutId && layer.layoutFrameId === layoutFrameId);
  const move = (index: number, target: number): void => {
    if (target < 0 || target >= layers.length) return;
    const next = [...layers];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onChange(next);
  };
  return <fieldset className="scene-layer-composer foundation-form" disabled={disabled}>
    <legend>重ねるシーン（下から順）</legend>
    {layers.length ? <ol>{layers.map((layer, index) => {
      const source = sources.get(layer.layoutId);
      return <li key={layer.id}>
        <span>{layerLabel(layer, source)}</span>
        {source?.isUnavailable ? <span className="err-text">シーンを読み込めません。削除されたか、閲覧できない可能性があります。</span> : null}
        <button type="button" className="ghost" disabled={index === 0} onClick={() => move(index, index - 1)}>下へ</button>
        <button type="button" className="ghost" disabled={index === layers.length - 1} onClick={() => move(index, index + 1)}>上へ</button>
        <button type="button" className="danger" onClick={() => onChange(layers.filter(item => item.id !== layer.id))}>外す</button>
      </li>;
    })}</ol> : <p className="meta">この画面に重ねているシーンはありません。</p>}
    <label className="simple-field"><span>重ねるシーン</span><select value={layoutId} onChange={event => { setLayoutId(event.target.value); setLayoutFrameId(''); }}>
      <option value="">選択してください</option>
      {(scenes.data?.items ?? []).filter(item => item.id !== lid).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {scenes.isError ? <p role="alert" className="err-text">シーン一覧を読み込めませんでした。</p> : null}
    {candidate.isError ? <p role="alert" className="err-text">選んだシーンを読み込めませんでした。</p> : null}
    <label className="simple-field"><span>そのシーンの画面</span><select value={layoutFrameId} disabled={!candidateFrames.length} onChange={event => setLayoutFrameId(event.target.value)}>
      <option value="">選択してください</option>
      {candidateFrames.map(item => <option key={item.id} value={item.id}>{frameLabel(item)}</option>)}
    </select></label>
    <button type="button" disabled={!layoutId || !layoutFrameId || isDuplicate || layers.length >= MAX_LAYERS_PER_FRAME} onClick={() => {
      onChange([...layers, { id: crypto.randomUUID(), frameId, layoutId, layoutFrameId }]);
      setLayoutFrameId('');
    }}>この画面に重ねる</button>
    {isDuplicate ? <p className="meta">同じ画面はすでに重ねています。</p> : null}
    {layers.length >= MAX_LAYERS_PER_FRAME ? <p className="meta">1つの画面に重ねられるのは{MAX_LAYERS_PER_FRAME}件までです。</p> : null}
  </fieldset>;
}
