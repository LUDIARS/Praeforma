import React from 'react';
import type { DesignCanvasDocument } from '../../../../shared/design-canvas.ts';
import { layersForFrame, type SceneLayer } from '../../../../shared/scene-layers.ts';
import { downloadText } from '../../lib/download-text.ts';
import { deviceLabels } from '../ux-design/FrameDeviceControls.tsx';
import { SceneLayerComposer } from './SceneLayerComposer.tsx';
import { SceneVisibilityToggles } from './SceneVisibilityToggles.tsx';
import { telaOverlayForFrame } from './scene-layer-export.ts';
import type { LayerSceneSource } from './useSceneLayerSources.ts';

interface Props {
  pid: string;
  lid: string;
  sceneName: string;
  canvas: DesignCanvasDocument;
  layers: readonly SceneLayer[];
  sources: ReadonlyMap<string, LayerSceneSource>;
  hidden: ReadonlySet<string>;
  disabled: boolean;
  onLayersChange: (layers: SceneLayer[]) => void;
  onHiddenChange: (hidden: ReadonlySet<string>) => void;
}

/** Scene layering for the scene editor: per-scene visibility, per-frame stacking and Tela export. PF-SCENE-8. */
export function SceneLayerPanel(props: Props): React.ReactElement {
  const [frameId, setFrameId] = React.useState(props.canvas.frames[0]?.id ?? '');
  const [exportError, setExportError] = React.useState('');
  const frame = props.canvas.frames.find(item => item.id === frameId) ?? props.canvas.frames[0];
  const layeredIds = [...new Set(props.layers.map(layer => layer.layoutId))];
  const scenes = [
    { layoutId: props.lid, name: `${props.sceneName}（このシーン）` },
    ...layeredIds.map(layoutId => ({ layoutId, name: props.sources.get(layoutId)?.name ?? '参照先なし' })),
  ];
  const exportFrame = (id: string): void => {
    try {
      const text = telaOverlayForFrame({ lid: props.lid, sceneName: props.sceneName, canvas: props.canvas, frameId: id, layers: props.layers, sources: props.sources, hidden: props.hidden });
      downloadText('praeforma-scene-overlay.tela', text);
      setExportError('');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Tela 用に書き出せませんでした。');
    }
  };
  return <section className="panel scene-layer-panel">
    <h2>シーンの重ね合わせ</h2>
    <p className="meta">オプションメニューなど別のシーンを画面に重ね、シーンごとに仮配置の表示・非表示を切り替えます。重ねたシーンの要素は元のシーンで編集してください。</p>
    <SceneVisibilityToggles scenes={scenes} hidden={props.hidden} onChange={props.onHiddenChange} />
    {!frame ? <p>画面を追加すると、重ねるシーンを設定できます。</p> : <>
      <label className="simple-field"><span>設定する画面</span><select value={frame.id} onChange={event => setFrameId(event.target.value)}>
        {props.canvas.frames.map(item => <option key={item.id} value={item.id}>{item.name} / {deviceLabels[item.device ?? 'unspecified']}</option>)}
      </select></label>
      <SceneLayerComposer key={frame.id} pid={props.pid} lid={props.lid} frameId={frame.id} layers={layersForFrame(props.layers, frame.id)} sources={props.sources} disabled={props.disabled}
        onChange={next => props.onLayersChange([...props.layers.filter(layer => layer.frameId !== frame.id), ...next])} />
      <button type="button" className="ghost" onClick={() => exportFrame(frame.id)}>この画面を Tela 用に書き出す</button>
      <p className="meta">書き出したファイルは Tela の <code>tela_overlay --scene-overlay</code> で読み込みます。いまの表示・非表示が Tela での初期表示になります。</p>
      {exportError ? <p role="alert" className="err-text">{exportError}</p> : null}
    </>}
  </section>;
}
