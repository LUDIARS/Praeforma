// 企画概要書の生成を裏で走らせ、その状態を持つ (spec/feature/concept-sheet.md PF-CS-9)。
// Astra の設計は数分〜十数分かかり、HTTP の 1 往復や中継 (Cloudflare 等) の待ち時間に収まらない。
// そこで受付だけを返し、画面は状態を問い合わせる。状態はこのプロセスのメモリだけに持つ
// (再起動で消える。そのときは画面で「作り直す」をもう一度押す)。
import { AppError } from './errors.ts';

export type ConceptSheetJob =
  | { sheetId: string; state: 'running'; startedAt: string }
  | { sheetId: string; state: 'failed'; startedAt: string; finishedAt: string; error: string };

/** 同じプロジェクトの同時生成と、サーバ全体でこの本数を超える生成を断る。 */
const MAX_PARALLEL = 2;

export class ConceptSheetJobs {
  private readonly jobs = new Map<string, ConceptSheetJob>();
  constructor(private readonly now: () => Date = () => new Date()) {}

  /** プロジェクトの最新の生成 (走っている / 失敗した)。成功したものは残さない (シートとして一覧に出る)。 */
  get(projectId: string): ConceptSheetJob | null { return this.jobs.get(projectId) ?? null; }

  /** 受け付けられなければ 429。task は reject しても外へ投げず、失敗として状態に残す。 */
  start(projectId: string, sheetId: string, task: () => Promise<void>): void {
    const running = [...this.jobs.values()].filter((j) => j.state === 'running').length;
    if (this.jobs.get(projectId)?.state === 'running' || running >= MAX_PARALLEL) {
      throw new AppError('concept_sheet_generation_busy', 429);
    }
    const startedAt = this.now().toISOString();
    this.jobs.set(projectId, { sheetId, state: 'running', startedAt });
    // 待たない: 結果は状態に残し、画面は GET で受け取る。例外はここで受け止め、unhandled rejection にしない。
    void task().then(
      () => { this.jobs.delete(projectId); },
      (error: unknown) => {
        const code = error instanceof AppError ? error.message : 'concept_sheet_generation_failed';
        // 想定外の失敗だけを記録する (AppError は状態として画面に返る)。材料や生成物はログに出さない。
        if (!(error instanceof AppError)) console.error(`[concept-sheet] generation failed for ${sheetId}: ${String(error)}`);
        this.jobs.set(projectId, { sheetId, state: 'failed', startedAt, finishedAt: this.now().toISOString(), error: code });
      },
    );
  }
}
