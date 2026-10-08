/** ブロック一覧の概要行。 本文の最初の空でない行を上限文字数で切る。 */
export function summarize(text: string, max = 80): string {
  const line = text.split('\n').map((item) => item.trim()).find(Boolean) ?? '';
  return line.length > max ? `${line.slice(0, max)}…` : line;
}
