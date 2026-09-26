// 空のキャッチコピーを AI の案で埋める (spec/feature/project-ux-goal.md PF-GOAL-W3)。
// 人の文言は上書きしない: 空で、かつ UX/ゴールの版が生成を始めたときのままの行だけを書き換える。
// 版を 1 つ進めるので、開いている UX/ゴールの画面が古い空欄で上書きすることもない (PF-GOAL-INV2)。
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from './connection.ts';
import { projects } from './schema/project.ts';

/** 埋めたら true。人が先に書いた・別の保存が入った・プロジェクトが無いときは false。 */
export async function fillEmptyCatchcopy(projectId: string, text: string, expectedRevision: number): Promise<boolean> {
  const rows = await getDb().update(projects)
    .set({ uxCatchcopy: text, uxCatchcopyOrigin: 'ai', uxGoalRevision: expectedRevision + 1, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt), eq(projects.uxCatchcopy, ''),
      eq(projects.uxGoalRevision, expectedRevision)))
    .returning({ id: projects.id });
  return rows.length === 1;
}
