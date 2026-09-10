import { webStyleSchema, type WebStyle } from './web-scene.ts';

export function importClassRules(css: string, device: WebStyle['device']): WebStyle[] {
  if (css.length > 100000) throw new Error('CSSは100KB以内で指定してください。');
  const result: WebStyle[] = [];
  let remaining = css.trim();
  while (remaining) {
    const match = /^\.([A-Za-z_][A-Za-z0-9_-]*)\s*\{([^{}]*)\}/.exec(remaining);
    if (!match) throw new Error('単一クラスの規則を指定してください（例: .button { color: white; }）。複合セレクタや@規則は個別に定義してください。');
    const declarations: Record<string, string> = {};
    for (const declaration of (match[2] ?? '').split(';').filter(value => value.trim())) {
      const colon = declaration.indexOf(':');
      if (colon < 0) throw new Error('CSS宣言は property: value で指定してください。');
      declarations[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
    }
    const parsed = webStyleSchema.safeParse({ className: match[1], device, declarations });
    if (!parsed.success) throw new Error('未対応のCSSプロパティか外部参照が含まれています。');
    result.push(parsed.data); remaining = remaining.slice(match[0].length).trim();
  }
  return result;
}
