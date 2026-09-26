// Astra の出力を、保存してよい企画概要書か確かめる (spec/feature/concept-sheet.md PF-CS-3 / PF-CS-5)。
// 形・字数・紙面の安全・キャッチコピーの固定・シーン名の明記を見る。問題は Astra へそのまま返せる言葉で並べる。
import { z } from 'zod';
import { DESIGN_LIMITS as L, type ConceptSheetDesign } from '../../../shared/concept-sheet.ts';
import { designHtmlIssues, sheetShowsText } from '../../../shared/concept-sheet-html.ts';

const outputSchema = z.object({
  title: z.string().trim().max(L.title),
  catchcopy: z.string().trim().max(L.catchcopy),
  concept: z.string().trim().max(L.concept),
  scene: z.object({ index: z.number().int().min(0), label: z.string(), reason: z.string().trim().max(L.reason) }),
  sections: z.array(z.string().trim().min(1).max(L.section)).max(L.sectionsMax),
  html: z.string(),
  error: z.string().max(300),
});

export type DesignCheck =
  | { kind: 'ok'; design: ConceptSheetDesign }
  | { kind: 'insufficient' }
  | { kind: 'issues'; issues: string[]; html: string };

export interface DesignCheckContext {
  /** 画面の候補の名前 (添付の順)。 */
  imageLabels: string[];
  /** UX/ゴールのキャッチコピー。空でなければ 1 字も変えずに載っていること。 */
  catchcopy: string;
}

export function checkConceptSheetOutput(raw: string, ctx: DesignCheckContext): DesignCheck {
  let value: unknown;
  try { value = JSON.parse(raw.trim()); } catch { return { kind: 'issues', issues: ['指定の JSON だけを返す'], html: '' }; }
  const parsed = outputSchema.safeParse(value);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || '(全体)'))];
    return { kind: 'issues', issues: [`出力の形と字数の上限を守る (${fields.join(', ')})`], html: '' };
  }
  const out = parsed.data;
  if (out.error.trim()) return { kind: 'insufficient' };

  const issues: string[] = [];
  if (!out.title || !out.concept) issues.push('title と concept を空にしない');
  if (out.sections.length === 0) issues.push('載せた項目の見出しを sections に並べる');
  const label = ctx.imageLabels[out.scene.index];
  if (label === undefined) issues.push(`scene.index は 0〜${ctx.imageLabels.length - 1} の候補から選ぶ`);
  else if (!sheetShowsText(out.html, label)) issues.push(`選んだ画面の名前「${label}」を、候補の名前のまま紙面に書く (「現在の画面：${label}」など)`);
  issues.push(...designHtmlIssues(out.html, ctx.imageLabels.length));

  const catchcopy = ctx.catchcopy || out.catchcopy;
  if (ctx.catchcopy && out.catchcopy !== ctx.catchcopy) issues.push(`catchcopy は材料の文言「${ctx.catchcopy}」と 1 字も変えずに同じにする`);
  if (!catchcopy) issues.push('catchcopy を空にしない');
  else if (!sheetShowsText(out.html, catchcopy)) issues.push(`キャッチコピー「${catchcopy}」を 1 字も変えずに紙面に載せる`);

  if (issues.length > 0 || label === undefined) return { kind: 'issues', issues, html: out.html };
  return {
    kind: 'ok',
    design: {
      title: out.title, catchcopy, concept: out.concept,
      // 名前は Astra の書いたものではなく、人が付けた候補の名前を正とする。
      scene: { index: out.scene.index, label, reason: out.scene.reason },
      sections: out.sections, html: out.html,
    },
  };
}
