// 企画概要書 1 枚の表示と出力 (spec/feature/concept-sheet.md PF-CS-5)。
// 表示・印刷 (PDF 保存)・HTML 保存は、同じ仕上げ済み HTML (shared/concept-sheet-html.ts) を使う。
// iframe は script を許さない。印刷のダイアログだけを許す (allow-modals)。紙面には CSP も入っている。
import React from 'react';
import { finalizeConceptSheetHtml } from '../../../../shared/concept-sheet-html.ts';
import type { ConceptSheetRecord } from '../../../../shared/concept-sheet.ts';
import { downloadText } from '../../lib/download-text.ts';

/** A4 横 (297mm × 210mm) に上下の余白を足した、 iframe 内の大きさ (CSS px)。 */
const SHEET_WIDTH = 1160;
const SHEET_HEIGHT = 840;

export function ConceptSheetPreview({ sheet }: { sheet: ConceptSheetRecord }): React.ReactElement {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const html = React.useMemo(() => finalizeConceptSheetHtml(sheet.design.html, sheet.images), [sheet]);

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = (): void => setScale(Math.min(1, el.clientWidth / SHEET_WIDTH));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const print = (): void => { frame.current?.contentWindow?.print(); };
  const save = (): void => downloadText(`${sheet.design.title}-企画概要書.html`, html, 'text/html;charset=utf-8');
  const { scene } = sheet.design;

  return <section className="concept-sheet-preview" aria-label="企画概要書のプレビュー">
    <div className="concept-sheet-actions">
      <button type="button" onClick={print}>印刷 / PDF で保存</button>
      <button type="button" onClick={save}>HTML で保存</button>
      <span className="concept-sheet-hint">PDF は印刷の送り先で「PDF に保存」を選びます（A4 横 1 ページ）。</span>
    </div>
    <div ref={box} className="concept-sheet-frame-box" style={{ height: SHEET_HEIGHT * scale }}>
      <iframe ref={frame} title={`${sheet.design.title} の企画概要書`} srcDoc={html}
        sandbox="allow-same-origin allow-modals"
        style={{ width: SHEET_WIDTH, height: SHEET_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0 }} />
    </div>
    <dl className="concept-sheet-facts">
      <dt>AI が選んだ画面</dt><dd>{scene.label}{scene.reason && <span className="concept-sheet-hint">（{scene.reason}）</span>}</dd>
      <dt>載せた項目</dt><dd>{sheet.design.sections.join(' / ')}</dd>
      <dt>作成</dt><dd>UX 第{sheet.source.uxGoalRevision}版・{sheet.source.model}・{sheet.updatedAt.slice(0, 10)}</dd>
      {sheet.source.instructions && <><dt>作り直しの指示</dt><dd>{sheet.source.instructions}</dd></>}
    </dl>
  </section>;
}
