import React from 'react';
import { mountPraeformaOverlay, type OverlayHandle } from '../../../libraries/browser-overlay/index.mjs';
import { getToken } from '../lib/api.ts';

export function ReviewOverlayLauncher({ projectId, layoutId }: { projectId: string; layoutId?: string }): React.ReactElement {
  const overlay = React.useRef<OverlayHandle | null>(null);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => () => { overlay.current?.destroy(); overlay.current = null; }, [projectId, layoutId]);
  React.useEffect(() => { setOpen(false); }, [projectId, layoutId]);
  return <button type="button" className="ghost" onClick={() => {
    if (overlay.current) { overlay.current.destroy(); overlay.current = null; setOpen(false); return; }
    overlay.current = mountPraeformaOverlay({ baseUrl: location.origin, projectId, layoutId,
      headers: () => { const token = getToken(); return new Headers(token ? { Authorization: `Bearer ${token}` } : undefined); } });
    setOpen(true);
  }}>{open ? '確認オーバーレイを閉じる' : '仕様・テスト状況を重ねて表示'}</button>;
}
