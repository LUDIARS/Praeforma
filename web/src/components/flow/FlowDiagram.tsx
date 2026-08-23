// 下段タブ「遷移図」: サーバ生成の Mermaid を描画 + 生テキスト表示 / ダウンロード (§7.1)。
//
// @spec 7.1 遷移図

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { screenFlowApi } from '../../lib/screen-flow-api.ts';

interface Props {
  pid: string;
  /** 構造が変わったら増やして再取得させる。 */
  revision: number;
}

let mermaidReady: Promise<typeof import('mermaid')['default']> | null = null;
function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((m) => {
      m.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
      return m.default;
    });
  }
  return mermaidReady;
}

export function FlowDiagram({ pid, revision }: Props): React.ReactElement {
  const [group, setGroup] = React.useState<'none' | 'domain'>('none');
  const [svg, setSvg] = React.useState('');
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const q = useQuery({
    queryKey: ['flow.mmd', pid, group, revision],
    queryFn: () => screenFlowApi.flowMermaid(pid, group),
  });

  React.useEffect(() => {
    if (!q.data) return;
    let cancelled = false;
    loadMermaid()
      .then((m) => m.render(`flow-${Date.now()}`, q.data))
      .then((r) => {
        if (!cancelled) {
          setSvg(r.svg);
          setRenderError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setRenderError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [q.data]);

  function download(): void {
    if (!q.data) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([q.data], { type: 'text/plain' }));
    a.download = 'flow.mmd';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flow-diagram">
      <div className="flow-toolbar">
        <label>
          <input type="checkbox" checked={group === 'domain'} onChange={(e) => setGroup(e.target.checked ? 'domain' : 'none')} />{' '}
          ドメインでグループ化
        </label>
        <button type="button" className="ghost" onClick={download} disabled={!q.data}>
          flow.mmd をダウンロード
        </button>
      </div>
      {q.isLoading ? <div className="muted">loading…</div> : null}
      {renderError ? <div className="error">Mermaid 描画失敗: {renderError}</div> : null}
      {/* mermaid の出力は securityLevel=strict でサニタイズ済み */}
      <div className="flow-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      <details>
        <summary>Mermaid ソース</summary>
        <pre className="flow-source">{q.data}</pre>
      </details>
    </div>
  );
}
