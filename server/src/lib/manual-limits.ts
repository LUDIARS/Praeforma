/** One source for the manual's shape limits, so validation and the writer's prompt cannot drift apart. */
export const MANUAL_LIMITS = {
  title: 100, purpose: 1200,
  sections: { min: 1, max: 12 }, heading: 100, text: 1200,
  caption: 300, steps: { min: 2, max: 12 }, label: 200,
  branches: { max: 4 }, condition: 150, result: 250,
} as const;

/** The writer only sees the example JSON otherwise, so it has no way to know a limit before it breaks one. */
export function manualFormatRules(): string {
  const l = MANUAL_LIMITS;
  return [
    '形の上限（超えると受け付けない）:',
    `- title は ${l.title} 字まで。purpose は ${l.purpose} 字まで。どの欄も空にしない。`,
    `- sections は ${l.sections.min}〜${l.sections.max} 個。heading は ${l.heading} 字まで、text は ${l.text} 字まで。`,
    `- diagram.caption は ${l.caption} 字まで。diagram.steps は ${l.steps.min}〜${l.steps.max} 段。label は ${l.label} 字まで。`,
    `- 1 段の branches は ${l.branches.max} 個まで（分岐が無ければ空の配列）。condition は ${l.condition} 字まで、result は ${l.result} 字まで。`,
    `- 選択肢が ${l.branches.max + 1} 個以上あるときは、段を分けるか、似た選択肢をまとめて ${l.branches.max} 個以内にする。`,
    '- 上の形にない項目を足さない。',
  ].join('\n');
}
