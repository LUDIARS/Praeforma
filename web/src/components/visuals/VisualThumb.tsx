// ビジュアル 1 枚の縮小表示。画像は見えるときに 1 枚ずつ読む (一覧 API は画像を返さない)。
import React from 'react';
import type { ProjectVisual } from '../../../../shared/project-visual.ts';
import { useVisualImage } from '../../lib/use-visual-image.ts';

export function VisualThumb({ pid, visual }: { pid: string; visual: Pick<ProjectVisual, 'id' | 'digest' | 'label'> }): React.ReactElement {
  const { dataUrl, failed } = useVisualImage(pid, visual.id, visual.digest);
  if (dataUrl) return <img className="project-visual-thumb" src={dataUrl} alt={visual.label} />;
  return <span className="project-visual-thumb placeholder" role={failed ? 'alert' : 'status'}>
    {failed ? '画像を読み込めませんでした' : '読み込み中…'}</span>;
}
