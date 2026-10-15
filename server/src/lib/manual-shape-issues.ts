/** Explains a manual's shape failure from the issue path and limit only, never from the rejected model text. */
import { z } from 'zod';

const FIELDS: Record<string, string> = {
  title: '題名', purpose: 'できること', sections: '節', heading: '見出し', text: '本文',
  diagram: '図', caption: '図の説明', steps: '図の段', label: '段の文', branches: '分岐', condition: '分岐の条件', result: '分岐の結果',
};

function placeOf(path: readonly (string | number)[]): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i += 1) {
    const key = path[i];
    const next = path[i + 1];
    if (key === undefined || typeof key === 'number') continue;
    if (key === 'sections' && typeof next === 'number') parts.push(`${next + 1} 番目の節`);
    else if (key === 'steps' && typeof next === 'number') parts.push(`図の ${next + 1} 段目`);
    else if (key === 'branches' && typeof next === 'number') parts.push(`${next + 1} 番目の分岐`);
    else if (key === 'diagram' && path.length > i + 1) continue;
    else parts.push(FIELDS[key] ?? key);
  }
  return parts.join('の') || '文書';
}

export function describeShapeIssue(issue: z.ZodIssue): string {
  const place = placeOf(issue.path);
  if (issue.code === z.ZodIssueCode.too_big) {
    return issue.type === 'string' ? `${place}が長すぎます（${issue.maximum} 字まで）。` : `${place}が多すぎます（${issue.maximum} 個まで）。`;
  }
  if (issue.code === z.ZodIssueCode.too_small) {
    return issue.type === 'string' ? `${place}が空です。` : `${place}が少なすぎます（${issue.minimum} 個以上）。`;
  }
  if (issue.code === z.ZodIssueCode.unrecognized_keys) return `${place}に決められていない項目があります。`;
  return `${place}の形が違います。`;
}
