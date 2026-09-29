// 一覧に並べる企画概要書 1 枚の縮小表示 (spec/feature/concept-sheet.md PF-CS-8)。
// 紙面は画像を含んで重いので、画面に入ってから最新版を取りに行く。表示は詳細と同じ仕上げ済み HTML を縮めたもの。
// iframe は script を許さず、クリックは外側のリンクが受ける (pointer-events: none)。
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { finalizeConceptSheetHtml } from '../../../../shared/concept-sheet-html.ts';
import { conceptSheetApi, conceptSheetError } from '../../lib/concept-sheets-api.ts';

/** 詳細のプレビュー (ConceptSheetPreview) と同じ、A4 横の紙面の大きさ (CSS px)。 */
const SHEET_WIDTH = 1160;
const SHEET_HEIGHT = 840;

/** 要素が一度でも画面に入ったら true。以後は戻さない (取った紙面を捨てない)。 */
function useSeen<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = React.useRef<T>(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setSeen(true);
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen]);
  return [ref, seen];
}

/** 枠の幅に合わせた縮小率。 */
function useFitScale<T extends Element>(ref: React.RefObject<T | null>): number {
  const [scale, setScale] = React.useState(0.25);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = (): void => setScale(el.clientWidth / SHEET_WIDTH);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return scale;
}

export function ConceptSheetThumbnail({ pid, sheetId, title }: { pid: string; sheetId: string; title: string }): React.ReactElement {
  const [box, seen] = useSeen<HTMLDivElement>();
  const scale = useFitScale(box);
  const query = useQuery({
    queryKey: ['concept-sheet', pid, sheetId],
    queryFn: () => conceptSheetApi.get(pid, sheetId),
    enabled: seen,
  });
  const html = React.useMemo(() => (query.data
    ? finalizeConceptSheetHtml(query.data.sheet.design.html, query.data.sheet.images) : null), [query.data]);

  return <div ref={box} className="concept-sheet-thumb" style={{ aspectRatio: `${SHEET_WIDTH} / ${SHEET_HEIGHT}` }}>
    {html
      ? <iframe title={`${title} の企画概要書`} srcDoc={html} sandbox="allow-same-origin" tabIndex={-1} aria-hidden
        style={{ width: SHEET_WIDTH, height: SHEET_HEIGHT, transform: `scale(${scale})` }} />
      : <span className="concept-sheet-thumb-status" role={query.isError ? 'alert' : 'status'}>
        {query.isError ? conceptSheetError(query.error) : '紙面を読み込み中…'}
      </span>}
  </div>;
}
