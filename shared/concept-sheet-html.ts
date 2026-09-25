// 企画概要書 1 枚を、 それだけで開ける HTML にする (spec/feature/concept-sheet.md PF-CS-5)。
// 画面のプレビュー・印刷 (PDF 保存)・HTML 保存が同じ文字列を使い、 レイアウトを二重に持たない。
// script は含めない。 文字はすべてエスケープし、 画像は検証済みの data URL だけを埋め込む。
import type { ConceptSheetDocument } from './concept-sheet.ts';

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const SAFE_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

const STYLE = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif; color: #1d1b22; background: #e9e7ef; }
.sheet { width: 297mm; height: 210mm; margin: 0 auto; padding: 11mm 12mm 9mm; background: #fffdf9; overflow: hidden;
  display: grid; grid-template-columns: 57% 1fr; grid-template-rows: auto 1fr auto auto; gap: 5mm 7mm;
  grid-template-areas: "visual head" "visual hooks" "journey journey" "people goal"; }
@media screen { .sheet { margin: 16px auto; box-shadow: 0 8px 30px rgba(0,0,0,.18); } }
@media print { body { background: none; } .sheet { margin: 0; box-shadow: none; } }
h1, h2, p, ol, ul { margin: 0; }
h2 { font-size: 9pt; letter-spacing: .12em; color: #c2386b; margin-bottom: 2mm; }
.head { grid-area: head; }
.kicker { font-size: 8pt; letter-spacing: .1em; color: #7b7588; }
.catch { font-size: 24pt; line-height: 1.25; margin: 2mm 0; }
.title { font-size: 12pt; font-weight: 700; }
.lead { font-size: 10pt; line-height: 1.6; margin-top: 2mm; color: #3c3846; }
.visual { grid-area: visual; display: flex; flex-direction: column; gap: 2mm; min-height: 0; }
.visual img { width: 100%; flex: 1 1 auto; min-height: 0; object-fit: cover; border-radius: 3mm; }
.visual .none { flex: 1 1 auto; border: 1px dashed #b9b3c6; border-radius: 3mm; display: flex; align-items: center; justify-content: center; color: #8a849a; font-size: 10pt; }
.caption { font-size: 8.5pt; color: #5d586b; }
.hooks { grid-area: hooks; min-height: 0; }
.hooks ol { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 2.5mm; }
.hooks li { border-left: 1.2mm solid #e0457b; padding: 1mm 0 1mm 3mm; }
.hooks strong { display: block; font-size: 11pt; }
.hooks span { display: block; font-size: 9pt; line-height: 1.5; color: #3c3846; }
.journey { grid-area: journey; }
.steps { list-style: none; padding: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 3mm; }
.steps li { background: #f6eef3; border-radius: 2.5mm; padding: 2.5mm 3mm; position: relative; }
.steps b { display: block; font-size: 9.5pt; color: #c2386b; }
.steps span { display: block; font-size: 8.5pt; line-height: 1.5; }
.people { grid-area: people; display: flex; flex-direction: column; gap: 3mm; }
.people p { font-size: 9.5pt; line-height: 1.5; }
.chips { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 2mm; }
.chips li { border: 1px solid #e0457b; color: #b8325f; border-radius: 99px; padding: .8mm 3mm; font-size: 9pt; }
.goal { grid-area: goal; }
.goal p { font-size: 10pt; line-height: 1.6; font-weight: 700; }
.footer { grid-column: 1 / -1; font-size: 7pt; color: #9690a6; text-align: right; margin-top: -3mm; }
`;

export interface ConceptSheetHtmlInput {
  projectName: string;
  document: ConceptSheetDocument;
  keyVisualDataUrl: string | null;
  /** 出典の一行 (例: 「Praeforma · UX/ゴール 第3版から生成」)。 */
  footer: string;
}

export function renderConceptSheetHtml(input: ConceptSheetHtmlInput): string {
  const d = input.document; const e = escapeHtml;
  const visual = input.keyVisualDataUrl && SAFE_IMAGE.test(input.keyVisualDataUrl)
    ? `<img src="${e(input.keyVisualDataUrl)}" alt="${e(d.visualCaption || 'キービジュアル')}">`
    : '<div class="none">キービジュアル未設定</div>';
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(d.title)} — 企画概要書</title><style>${STYLE}</style></head>
<body><main class="sheet">
<header class="head"><p class="kicker">企画概要書 · ${e(input.projectName)}</p><h1 class="catch">${e(d.catchcopy)}</h1>
<p class="title">${e(d.title)}</p><p class="lead">${e(d.lead)}</p></header>
<section class="visual">${visual}${d.visualCaption ? `<p class="caption">${e(d.visualCaption)}</p>` : ''}</section>
<section class="hooks"><h2>ここが刺さる</h2><ol>${d.hooks.map((h) => `<li><strong>${e(h.heading)}</strong><span>${e(h.text)}</span></li>`).join('')}</ol></section>
<section class="journey"><h2>体験のストーリー</h2><ol class="steps">${d.journey.map((j) => `<li><b>${e(j.scene)}</b><span>${e(j.text)}</span></li>`).join('')}</ol></section>
<section class="people"><div><h2>だれに</h2><p>${e(d.target)}</p></div>
<div><h2>かかわる感情</h2><ul class="chips">${d.emotions.map((m) => `<li>${e(m)}</li>`).join('')}</ul></div></section>
<section class="goal"><h2>目指す状態</h2><p>${e(d.goal)}</p></section>
<p class="footer">${e(input.footer)}</p>
</main></body></html>`;
}
