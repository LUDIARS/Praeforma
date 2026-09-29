// 全プロジェクトの企画概要書の一覧 (spec/feature/concept-sheet.md PF-CS-8) の並べ方。
// 2026-09-29 neco 指示で、一覧はプロジェクトごとの見出しではなく、生成済みの紙面そのものを 1 列の並びで見せる。
import type { ConceptSheetSummary } from './concept-sheet.ts';

export interface IndexProject { id: string; name: string }

/** プロジェクト 1 つ分の一覧の取得結果。error はそのプロジェクトだけの失敗。 */
export interface ConceptSheetIndexGroup<P extends IndexProject> {
  project: P;
  items: ConceptSheetSummary[];
  error: string | null;
}

export interface ConceptSheetIndexEntry<P extends IndexProject> { project: P; sheet: ConceptSheetSummary }

export interface ConceptSheetIndex<P extends IndexProject> {
  entries: ConceptSheetIndexEntry<P>[];
  /** 一覧を取れなかったプロジェクト。ほかのプロジェクトの紙面は並べる。 */
  failures: { project: P; error: string }[];
}

/** 最新版の更新が新しい順。同時刻はプロジェクト名、企画名の順で決める (並びが読み込みのたびに揺れないように)。 */
function compareEntries<P extends IndexProject>(a: ConceptSheetIndexEntry<P>, b: ConceptSheetIndexEntry<P>): number {
  if (a.sheet.updatedAt !== b.sheet.updatedAt) return a.sheet.updatedAt < b.sheet.updatedAt ? 1 : -1;
  return a.project.name.localeCompare(b.project.name, 'ja') || a.sheet.title.localeCompare(b.sheet.title, 'ja')
    || a.sheet.id.localeCompare(b.sheet.id);
}

export function arrangeConceptSheetIndex<P extends IndexProject>(groups: ConceptSheetIndexGroup<P>[]): ConceptSheetIndex<P> {
  const entries = groups.flatMap(({ project, items }) => items.map((sheet) => ({ project, sheet })));
  const failures = groups.flatMap(({ project, error }) => (error ? [{ project, error }] : []));
  return { entries: entries.sort(compareEntries), failures };
}
