import React from 'react';
import type { CanvasFrame } from '../../lib/ux-design-api.ts';

type Device = NonNullable<CanvasFrame['device']>;
const maximumCanvasCoordinate = 100_000;
export const deviceLabels: Record<Device, string> = { unspecified: '未指定', desktop: 'PC', mobile: 'スマホ' };

/** Device is an explicit authoring choice, never inferred from image dimensions. */
export function createDeviceFrame(device: 'desktop' | 'mobile', id: string, x: number): CanvasFrame {
  const viewport = device === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 };
  const boundedX = Number.isFinite(x) ? Math.max(-maximumCanvasCoordinate, Math.min(maximumCanvasCoordinate, x)) : 40;
  return { id, device, name: deviceLabels[device], description: '', states: [], x: boundedX, y: 70, ...viewport, viewport };
}

export function SceneDeviceSelect({ value, onChange }: { value: CanvasFrame['device']; onChange: (device: Device) => void }): React.ReactElement {
  return <label className="simple-field"><span>対象端末</span><select value={value ?? 'unspecified'} onChange={event => onChange(event.target.value as Device)}>
    {Object.entries(deviceLabels).map(([device, label]) => <option key={device} value={device}>{label}</option>)}
  </select></label>;
}

export function SceneDeviceInspector({ frame, onChange }: { frame: CanvasFrame; onChange: (patch: Partial<CanvasFrame>) => void }): React.ReactElement {
  return <>
    <SceneDeviceSelect value={frame.device} onChange={device => onChange({ device })} />
    <div className="ux-number-fields">{(['width', 'height'] as const).map(axis => <label key={axis}>表示領域の{axis === 'width' ? '幅' : '高さ'}<input type="number" min="1" max="100000" value={frame.viewport[axis]} onChange={event => {
      const value = Number(event.target.value);
      if (Number.isFinite(value) && value > 0 && value <= 100000) onChange({ viewport: { ...frame.viewport, [axis]: value } });
    }} /></label>)}</div>
    <p className="meta">端末ごとに画面を追加して配置を定義できます。端末の変更では既存の配置やサイズは変わりません。</p>
  </>;
}
