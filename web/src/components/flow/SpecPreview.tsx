// 下段タブ「仕様書」: サーバ生成の spec.md をそのまま表示 / ダウンロード (§7.2)。
// 整形は決定的なサーバ側に任せ、 ここでは描画しない (Markdown レンダラを持たない)。
//
// @spec 7.2 仕様書

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { screenFlowApi } from '../../lib/screen-flow-api.ts';

interface Props {
  pid: string;
  revision: number;
}

export function SpecPreview({ pid, revision }: Props): React.ReactElement {
  const q = useQuery({ queryKey: ['spec.md', pid, revision], queryFn: () => screenFlowApi.specMarkdown(pid) });

  function download(): void {
    if (!q.data) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([q.data], { type: 'text/markdown' }));
    a.download = 'spec.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="spec-preview">
      <div className="flow-toolbar">
        <button type="button" className="ghost" onClick={download} disabled={!q.data}>
          spec.md をダウンロード
        </button>
        <button type="button" className="ghost" onClick={() => q.data && navigator.clipboard?.writeText(q.data)} disabled={!q.data}>
          コピー
        </button>
      </div>
      {q.isLoading ? <div className="muted">loading…</div> : null}
      <pre className="spec-source">{q.data}</pre>
    </div>
  );
}
