// キャッチコピーの決まり (spec/feature/project-ux-goal.md PF-GOAL-W3)。
// 人が考えた文言を正本にし、企画概要書はそれを 1 字も変えずに載せる。空のときだけ AI の案が入る。

export const CATCHCOPY_MAX = 80;

/** '' = 空 / 'human' = 人が保存した / 'ai' = 空欄を Astra が埋めた (人が書き換えるまで「AI案」)。 */
export type CatchcopyOrigin = '' | 'human' | 'ai';

/**
 * 保存後の origin。文言が変わらなければ元の origin を残す (他の欄だけ直しても AI案 は AI案 のまま)。
 * 文言が変われば人の文言、空にしたら空。
 */
export function nextCatchcopyOrigin(before: { text: string; origin: CatchcopyOrigin }, nextText: string): CatchcopyOrigin {
  if (nextText === before.text) return before.origin;
  return nextText === '' ? '' : 'human';
}
