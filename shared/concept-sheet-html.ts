// Astra が設計した企画概要書の HTML を、保存前に確かめ (designHtmlIssues)、表示・出力の前に仕上げる
// (finalizeConceptSheetHtml)。spec/feature/concept-sheet.md PF-CS-5。
// 画面のプレビュー・印刷 (PDF 保存)・HTML 保存は同じ仕上げ済み文字列を使う。
// 外へ通信する口と script を持たせない。表示は script を許さない sandbox iframe で行い、ここで CSP も付ける。
import { DESIGN_LIMITS, type ConceptSheetImage } from './concept-sheet.ts';

const PLACEHOLDER = /\{\{IMAGE_(\d+)\}\}/g;
const CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'";
const SAFE_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

const FORBIDDEN: Array<[RegExp, string]> = [
  [/<script\b/i, 'script を含めない'],
  [/\son[a-z]+\s*=/i, 'on で始まる属性 (イベント) を含めない'],
  [/javascript:|vbscript:/i, 'javascript: を含めない'],
  [/<(iframe|frame|frameset|object|embed|form|input|button|textarea|select|link|meta|base|audio|video|source|track|portal)\b/i, '埋め込み・フォーム・link・meta を含めない'],
  [/@import/i, '@import を含めない'],
  [/(?:src|href|srcset|poster|action)\s*=\s*["']?\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i, '外部や data: の URL を属性に書かない (画像は {{IMAGE_n}} を使う)'],
  [/url\(\s*["']?\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i, 'CSS の url() に外部や data: の URL を書かない (画像は {{IMAGE_n}} を使う)'],
];

/** 保存してよい HTML か。問題の一覧を返す (空なら可)。 */
export function designHtmlIssues(html: string, imageCount: number): string[] {
  const issues: string[] = [];
  if (new TextEncoder().encode(html).byteLength > DESIGN_LIMITS.htmlBytes) issues.push('大きすぎる');
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) issues.push('<html> から </html> までの 1 文書にする');
  for (const [pattern, message] of FORBIDDEN) if (pattern.test(html)) issues.push(message);
  for (const m of html.matchAll(PLACEHOLDER)) {
    if (Number(m[1]) >= imageCount) issues.push(`存在しない画像 {{IMAGE_${m[1]}}} を参照している`);
  }
  return [...new Set(issues)];
}

/** 紙面に読める文字として比べる形。style・タグ・文字参照・空白 (見た目のための改行位置の違い) を除く。 */
function visibleText(html: string): string {
  return html
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, '');
}

/** 文言が紙面にそのまま載っているか (キャッチコピー・シーン名の確認)。改行や空白の入れ方の違いだけを許す。 */
export function sheetShowsText(html: string, text: string): boolean {
  const wanted = text.replace(/\s+/g, '');
  return wanted !== '' && visibleText(html).includes(wanted);
}

/** 差し込み口に画像を埋め、CSP を head の先頭に置く。検証済みでない画像は埋めない。 */
export function finalizeConceptSheetHtml(html: string, images: Pick<ConceptSheetImage, 'dataUrl'>[]): string {
  const filled = html.replace(PLACEHOLDER, (whole, n: string) => {
    const url = images[Number(n)]?.dataUrl;
    return url && SAFE_IMAGE.test(url) ? url : '';
  });
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  if (/<head[^>]*>/i.test(filled)) return filled.replace(/<head[^>]*>/i, (head) => `${head}${meta}`);
  return filled.replace(/<html[^>]*>/i, (open) => `${open}<head>${meta}</head>`);
}
