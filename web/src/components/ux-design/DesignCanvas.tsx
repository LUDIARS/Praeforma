import React from 'react';
import type { CanvasElement, CanvasFrame, UxCanvasDocument } from '../../lib/ux-design-api.ts';
import { createDeviceFrame, deviceLabels, SceneDeviceInspector } from './FrameDeviceControls.tsx';

interface Props {
  canvas: UxCanvasDocument;
  onChange: (next: UxCanvasDocument) => void;
  onPreview: (next: UxCanvasDocument) => void;
  onCancelPreview: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  isSaving: boolean;
  isReadOnly?: boolean;
  showLayers?: boolean;
  referenceImages?: Record<string, string>;
}

type MoveTarget = { kind: 'frame' | 'element'; id: string; startX: number; startY: number; originalX: number; originalY: number };
type ResizeTarget = { id: string; startX: number; startY: number; width: number; height: number };

const elementKinds: CanvasElement['kind'][] = ['box', 'text', 'button', 'input', 'image', 'list'];
const minimumSize = 36;

function newFrame(index: number): CanvasFrame {
  return {
    id: crypto.randomUUID(), name: `画面 ${index + 1}`, description: '', states: [], x: 40 + index * 420, y: 70,
    width: 360, height: 640, viewport: { width: 390, height: 844 },
  };
}

export function DesignCanvas(props: Props): React.ReactElement {
  const { canvas, onChange } = props;
  const [zoom, setZoom] = React.useState(0.8);
  const [selected, setSelected] = React.useState<{ kind: 'frame' | 'element'; id: string } | null>(null);
  const [move, setMove] = React.useState<MoveTarget | null>(null);
  const [resize, setResize] = React.useState<ResizeTarget | null>(null);
  const [transitionFrom, setTransitionFrom] = React.useState<{ frameId: string; elementId: string | null } | null>(null);
  const previewRef = React.useRef<UxCanvasDocument | null>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const previousFrameCount = React.useRef(canvas.frames.length);
  React.useEffect(() => {
    if (props.showLayers && canvas.frames.length > previousFrameCount.current) {
      const frame = canvas.frames.at(-1); if (frame) setSelected({kind:'frame',id:frame.id});
    }
    previousFrameCount.current = canvas.frames.length;
  }, [canvas.frames.length, props.showLayers]);
  React.useEffect(() => {
    if (!props.showLayers || !selected) return;
    const element = selected.kind === 'element' ? canvas.elements.find(item => item.id === selected.id) : undefined;
    const frame = canvas.frames.find(item => item.id === (element?.frame_id ?? selected.id));
    if (frame) viewportRef.current?.scrollTo({left: Math.max(0,(frame.x+(element?.x??0))*zoom-60),top:Math.max(0,(frame.y+(element?.y??0))*zoom-90)});
    // Only changing selection should move the viewport; dragging and zoom keep the current view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.kind, props.showLayers]);

  const updateElement = (id: string, patch: Partial<CanvasElement>) => {
    onChange({ ...canvas, elements: canvas.elements.map((element) => element.id === id ? { ...element, ...patch } : element) });
  };
  const previewElement = (id: string, patch: Partial<CanvasElement>) => {
    const next = { ...canvas, elements: canvas.elements.map((element) => element.id === id ? { ...element, ...patch } : element) };
    previewRef.current = next;
    props.onPreview(next);
  };

  const addElement = (frameId: string, kind: CanvasElement['kind']) => {
    const element: CanvasElement = {
      id: crypto.randomUUID(), frame_id: frameId, kind, label: kind === 'box' ? '複雑な UI' : '新しい要素',
      x: 24, y: 80, width: kind === 'box' ? 220 : 140, height: kind === 'box' ? 120 : 48,
      sample_text: null, dynamic: null, follow: null,
    };
    onChange({ ...canvas, elements: [...canvas.elements, element] });
    setSelected({ kind: 'element', id: element.id });
  };

  const connectTo = (targetFrameId: string) => {
    if (!transitionFrom || transitionFrom.frameId === targetFrameId) return;
    onChange({
      ...canvas,
      transitions: [...canvas.transitions, {
        id: crypto.randomUUID(), from: { frame_id: transitionFrom.frameId, element_id: transitionFrom.elementId },
        to_frame_id: targetFrameId, trigger: 'tap', label: '遷移',
      }],
    });
    setTransitionFrom(null);
  };

  const selectedElement = selected?.kind === 'element' ? canvas.elements.find((item) => item.id === selected.id) : undefined;
  const selectedFrame = selected?.kind === 'frame' ? canvas.frames.find((item) => item.id === selected.id) : undefined;

  return (
    <section className={`ux-canvas-section ${props.isReadOnly ? 'locked' : ''}`} aria-label="画面と遷移の設計" aria-busy={props.isReadOnly}>
      <div className="ux-canvas-toolbar">
        {props.showLayers ? (['desktop', 'mobile'] as const).map(device => <button key={device} className="ghost" type="button" disabled={props.isReadOnly || canvas.frames.length >= 200} onClick={() => {
          const frame = createDeviceFrame(device, crypto.randomUUID(), Math.max(0, ...canvas.frames.map(item => item.x + item.width)) + 80);
          onChange({ ...canvas, frames: [...canvas.frames, frame] });
          setSelected({ kind: 'frame', id: frame.id });
        }}>＋ {deviceLabels[device]}画面</button>) : null}
        <button className="ghost" type="button" disabled={props.isReadOnly || canvas.frames.length >= 200} onClick={() => {
          const frame = newFrame(canvas.frames.length);
          onChange({ ...canvas, frames: [...canvas.frames, frame] });
          setSelected({ kind: 'frame', id: frame.id });
        }}>＋ 画面</button>
        <button className="ghost" type="button" disabled={props.isReadOnly || !props.canUndo} onClick={props.onUndo}>元に戻す</button>
        <button className="ghost" type="button" disabled={props.isReadOnly || !props.canRedo} onClick={props.onRedo}>やり直す</button>
        <button className="ghost" type="button" onClick={() => setZoom((value) => Math.max(0.4, value - 0.1))}>−</button>
        <span className="ux-zoom">{Math.round(zoom * 100)}%</span>
        <button className="ghost" type="button" onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}>＋</button>
        <span className="ux-toolbar-spacer" />
        {transitionFrom ? <span className="ux-connect-hint">接続先の画面をタップ</span> : null}
        <button className="primary" type="button" disabled={props.isSaving || props.isReadOnly} onClick={props.onSave}>
          {props.isSaving ? '保存中…' : `保存 r${canvas.revision}`}
        </button>
      </div>

      <fieldset className="ux-canvas-controls" disabled={props.isReadOnly}>
      {props.showLayers ? <aside className="ux-layer-list" aria-label="パーツ一覧">{canvas.frames.map(frame => <div key={frame.id}>
        <button type="button" className="ghost" aria-pressed={selected?.kind === 'frame' && selected.id === frame.id} onClick={() => setSelected({kind:'frame',id:frame.id})}>{frame.name} · {deviceLabels[frame.device ?? 'unspecified']}</button>
        {canvas.elements.filter(element => element.frame_id === frame.id).map(element => <button type="button" key={element.id} className="ghost ux-layer-element" aria-pressed={selected?.kind === 'element' && selected.id === element.id} onClick={() => setSelected({kind:'element',id:element.id})}>{element.label}</button>)}
      </div>)}</aside> : null}
      <div
        className="ux-canvas-viewport"
        ref={viewportRef}
        onPointerMove={(event) => {
          if (props.isReadOnly) return;
          if (move) {
            const dx = (event.clientX - move.startX) / zoom;
            const dy = (event.clientY - move.startY) / zoom;
            if (move.kind === 'frame') {
              const next = { ...canvas, frames: canvas.frames.map((item) => item.id === move.id ? { ...item, x: move.originalX + dx, y: move.originalY + dy } : item) };
              previewRef.current = next; props.onPreview(next);
            } else {
              previewElement(move.id, { x: Math.max(0, move.originalX + dx), y: Math.max(0, move.originalY + dy) });
            }
          }
          if (resize) {
            previewElement(resize.id, {
              width: Math.max(minimumSize, resize.width + (event.clientX - resize.startX) / zoom),
              height: Math.max(minimumSize, resize.height + (event.clientY - resize.startY) / zoom),
            });
          }
        }}
        onPointerUp={() => { if (previewRef.current) props.onChange(previewRef.current); previewRef.current = null; setMove(null); setResize(null); }}
        onPointerCancel={() => { previewRef.current = null; props.onCancelPreview(); setMove(null); setResize(null); }}
      >
        <div className="ux-canvas-world" style={{ transform: `scale(${zoom})`, width: Math.max(2400,...canvas.frames.map(frame => frame.x + frame.width + 120)), height: Math.max(1400,...canvas.frames.map(frame => frame.y + frame.height + 120)) }}>
          <svg className="ux-transition-layer" aria-hidden="true"><defs><marker id="ux-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>
            {canvas.transitions.map((transition) => {
              const from = canvas.frames.find((frame) => frame.id === transition.from.frame_id);
              const to = canvas.frames.find((frame) => frame.id === transition.to_frame_id);
              if (!from || !to) return null;
              const source = transition.from.element_id ? canvas.elements.find((element) => element.id === transition.from.element_id) : null;
              const x1 = source ? from.x + source.x + source.width : from.x + from.width;
              const y1 = source ? from.y + source.y + source.height / 2 : from.y + from.height / 2;
              return <g key={transition.id}><line x1={x1} y1={y1} x2={to.x} y2={to.y + to.height / 2} markerEnd="url(#ux-arrow)" /><text x={(x1 + to.x) / 2} y={(y1 + to.y + to.height / 2) / 2 - 6}>{transition.label}</text></g>;
            })}
          </svg>
          {canvas.frames.map((frame) => (
            <article
              key={frame.id}
              className={`ux-frame ${selected?.kind === 'frame' && selected.id === frame.id ? 'selected' : ''}`}
              style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
              onClick={() => { setSelected({ kind: 'frame', id: frame.id }); connectTo(frame.id); }}
            >
              {props.referenceImages?.[frame.id] ? <img src={props.referenceImages[frame.id]} alt="参照キャプチャ" style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:.35,pointerEvents:'none'}} /> : null}
              <header
                className="ux-frame-title"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setMove({ kind: 'frame', id: frame.id, startX: event.clientX, startY: event.clientY, originalX: frame.x, originalY: frame.y });
                }}
              >
                <strong>{frame.name}{props.showLayers ? ` · ${deviceLabels[frame.device ?? 'unspecified']}` : ''}</strong><span>{frame.viewport.width} × {frame.viewport.height}</span>
              </header>
              <div className="ux-frame-actions">
                {elementKinds.map((kind) => <button key={kind} type="button" onClick={(event) => { event.stopPropagation(); addElement(frame.id, kind); }}>{kind}</button>)}
              </div>
              {canvas.elements.filter((element) => element.frame_id === frame.id).map((element) => (
                <div
                  key={element.id}
                  className={`ux-element ${element.kind} ${selected?.kind === 'element' && selected.id === element.id ? 'selected' : ''}`}
                  style={{ left: element.x, top: element.y, width: element.width, height: element.height }}
                  onClick={(event) => { event.stopPropagation(); setSelected({ kind: 'element', id: element.id }); }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setMove({ kind: 'element', id: element.id, startX: event.clientX, startY: event.clientY, originalX: element.x, originalY: element.y });
                  }}
                >
                  <span>{element.sample_text ?? element.label}</span>
                  {element.dynamic?.enabled ? <em>動的</em> : null}
                  {element.follow ? <em>追従: {canvas.elements.find((item) => item.id === element.follow?.target_element_id)?.label ?? '対象'}</em> : null}
                  <button
                    className="ux-resize"
                    type="button"
                    aria-label="サイズ変更"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setMove(null);
                      setResize({ id: element.id, startX: event.clientX, startY: event.clientY, width: element.width, height: element.height });
                    }}
                  />
                </div>
              ))}
            </article>
          ))}
        </div>
      </div>

      {selectedElement ? (
        <aside className="ux-element-inspector foundation-form">
          <label className="simple-field"><span>表示名</span><input value={selectedElement.label} onChange={(event) => updateElement(selectedElement.id, { label: event.target.value })} /></label>
          <div className="ux-number-fields"><label>X<input type="number" value={Math.round(selectedElement.x)} onChange={(event) => updateElement(selectedElement.id, { x: Number(event.target.value) })} /></label><label>Y<input type="number" value={Math.round(selectedElement.y)} onChange={(event) => updateElement(selectedElement.id, { y: Number(event.target.value) })} /></label><label>W<input type="number" min={minimumSize} value={Math.round(selectedElement.width)} onChange={(event) => updateElement(selectedElement.id, { width: Number(event.target.value) })} /></label><label>H<input type="number" min={minimumSize} value={Math.round(selectedElement.height)} onChange={(event) => updateElement(selectedElement.id, { height: Number(event.target.value) })} /></label></div>
          <label className="simple-field"><span>動的オブジェクトのサンプル</span><input value={selectedElement.sample_text ?? ''} placeholder="表示するサンプル" onChange={(event) => updateElement(selectedElement.id, { sample_text: event.target.value || null })} /></label>
          {props.showLayers ? <label className="simple-field"><span>対応するノード・定義</span><input maxLength={500} value={selectedElement.dynamic?.source ?? ''} onChange={event => updateElement(selectedElement.id,{dynamic:{enabled:selectedElement.dynamic?.enabled??false,update_condition:selectedElement.dynamic?.update_condition??null,source:event.target.value||null}})} /></label> : null}
          <label className="check-row"><input type="checkbox" checked={selectedElement.dynamic?.enabled ?? false} onChange={(event) => updateElement(selectedElement.id, { dynamic: event.target.checked ? { enabled: true, source: null, update_condition: null } : null })} />動的に変わる</label>
          {selectedElement.dynamic ? <input aria-label="更新条件" placeholder="更新・消滅条件" value={selectedElement.dynamic.update_condition ?? ''} onChange={(event) => updateElement(selectedElement.id, { dynamic: { ...selectedElement.dynamic!, update_condition: event.target.value || null } })} /> : null}
          <label className="simple-field"><span>追従先（同じ画面内）</span><select value={selectedElement.follow?.target_element_id ?? ''} onChange={(event) => updateElement(selectedElement.id, { follow: event.target.value ? { target_element_id: event.target.value, condition: selectedElement.follow?.condition ?? '' } : null })}><option value="">追従しない</option>{canvas.elements.filter((item) => item.id !== selectedElement.id && item.frame_id === selectedElement.frame_id && item.follow?.target_element_id !== selectedElement.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          {selectedElement.follow ? <input aria-label="追従条件" placeholder="画面外・対象消滅時を含む条件" value={selectedElement.follow.condition} onChange={(event) => updateElement(selectedElement.id, { follow: { ...selectedElement.follow!, condition: event.target.value } })} /> : null}
          <button className="ghost" type="button" onClick={() => setTransitionFrom({ frameId: selectedElement.frame_id, elementId: selectedElement.id })}>この要素から遷移を接続</button>
          <button className="danger" type="button" onClick={() => { onChange({ ...canvas, elements: canvas.elements.filter((item) => item.id !== selectedElement.id).map((item) => item.follow?.target_element_id === selectedElement.id ? { ...item, follow: null } : item), transitions: canvas.transitions.filter((item) => item.from.element_id !== selectedElement.id) }); setSelected(null); }}>要素を削除</button>
        </aside>
      ) : null}
      {selectedFrame ? <aside className="ux-element-inspector foundation-form">
        {props.showLayers ? <SceneDeviceInspector frame={selectedFrame} onChange={patch => onChange({ ...canvas, frames: canvas.frames.map(item => item.id === selectedFrame.id ? { ...item, ...patch } : item) })} /> : null}
        <label className="simple-field"><span>画面名</span><input value={selectedFrame.name} onChange={(event) => onChange({ ...canvas, frames: canvas.frames.map((item) => item.id === selectedFrame.id ? { ...item, name: event.target.value } : item) })} /></label>
        <label className="simple-field"><span>この画面の仕様</span><textarea rows={3} value={selectedFrame.description ?? ''} onChange={(event) => onChange({ ...canvas, frames: canvas.frames.map((item) => item.id === selectedFrame.id ? { ...item, description: event.target.value } : item) })} /></label>
        <div className="ux-number-fields"><label>幅<input type="number" min="240" value={selectedFrame.width} onChange={(event) => onChange({ ...canvas, frames: canvas.frames.map((item) => item.id === selectedFrame.id ? { ...item, width: Number(event.target.value) } : item) })} /></label><label>高さ<input type="number" min="320" value={selectedFrame.height} onChange={(event) => onChange({ ...canvas, frames: canvas.frames.map((item) => item.id === selectedFrame.id ? { ...item, height: Number(event.target.value) } : item) })} /></label></div>
        <div className="ux-frame-states"><strong>画面内の状態</strong>{(selectedFrame.states ?? []).map((state) => <div key={state.id}><input aria-label="状態名" value={state.name} onChange={(event) => onChange({ ...canvas, frames: canvas.frames.map((item) => item.id === selectedFrame.id ? { ...item, states: item.states.map((value) => value.id === state.id ? { ...value, name: event.target.value } : value) } : item) })} /><input aria-label="発生条件" value={state.condition} placeholder="発生条件" onChange={(event) => onChange({ ...canvas, frames: canvas.frames.map((item) => item.id === selectedFrame.id ? { ...item, states: item.states.map((value) => value.id === state.id ? { ...value, condition: event.target.value } : value) } : item) })} /><textarea aria-label="表示と操作" value={state.content} placeholder="表示・操作・復帰" onChange={(event) => onChange({ ...canvas, frames: canvas.frames.map((item) => item.id === selectedFrame.id ? { ...item, states: item.states.map((value) => value.id === state.id ? { ...value, content: event.target.value } : value) } : item) })} /><button className="danger" type="button" onClick={() => onChange({ ...canvas, frames: canvas.frames.map((item) => item.id === selectedFrame.id ? { ...item, states: item.states.filter((value) => value.id !== state.id) } : item) })}>削除</button></div>)}<button className="ghost" type="button" onClick={() => onChange({ ...canvas, frames: canvas.frames.map((item) => item.id === selectedFrame.id ? { ...item, states: [...(item.states ?? []), { id: crypto.randomUUID(), name: 'loading', condition: '', content: '' }] } : item) })}>＋ 状態</button></div>
        <button className="ghost" type="button" onClick={() => setTransitionFrom({ frameId: selectedFrame.id, elementId: null })}>この画面から遷移を接続</button>
        <button className="danger" type="button" onClick={() => {
          const removedIds = new Set(canvas.elements.filter((item) => item.frame_id === selectedFrame.id).map((item) => item.id));
          onChange({ ...canvas, frames: canvas.frames.filter((item) => item.id !== selectedFrame.id), elements: canvas.elements.filter((item) => item.frame_id !== selectedFrame.id).map((item) => item.follow && removedIds.has(item.follow.target_element_id) ? { ...item, follow: null } : item), transitions: canvas.transitions.filter((item) => item.from.frame_id !== selectedFrame.id && item.to_frame_id !== selectedFrame.id) }); setSelected(null);
        }}>画面を削除</button>
      </aside> : null}
      <div className="ux-transition-editor"><h3>遷移</h3>{canvas.transitions.map((transition) => <div key={transition.id}><input aria-label="遷移名" value={transition.label} onChange={(event) => onChange({ ...canvas, transitions: canvas.transitions.map((item) => item.id === transition.id ? { ...item, label: event.target.value } : item) })} /><input aria-label="トリガーまたは条件" value={transition.trigger} onChange={(event) => onChange({ ...canvas, transitions: canvas.transitions.map((item) => item.id === transition.id ? { ...item, trigger: event.target.value } : item) })} /><button className="danger" type="button" onClick={() => onChange({ ...canvas, transitions: canvas.transitions.filter((item) => item.id !== transition.id) })}>削除</button></div>)}</div>
      </fieldset>
    </section>
  );
}
