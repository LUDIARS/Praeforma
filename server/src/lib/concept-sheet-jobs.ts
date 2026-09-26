// 企画概要書の生成を裏で走らせ、その状態を持つ (spec/feature/concept-sheet.md PF-CS-9 / PF-CS-11)。
// Astra の設計は数分〜十数分かかり、HTTP の 1 往復や中継 (Cloudflare 等) の待ち時間に収まらない。
// そこで受付だけを返し、画面は状態を問い合わせる。状態はこのプロセスのメモリだけに持つ
// (再起動で消える。そのときは画面で「作り直す」をもう一度押す。自動更新は起動時に予約し直す)。
// 人の作成・作り直し (manual) と自動更新 (auto) は同じ枠を使い、同じプロジェクトでは同時に走らせない。
import { AppError } from './errors.ts';
import type { ConceptSheetJob } from '../../../shared/concept-sheet.ts';

export type { ConceptSheetJob };

/** 同じプロジェクトの同時生成と、サーバ全体でこの本数を超える生成を断る。 */
const MAX_PARALLEL = 2;

export class ConceptSheetJobs {
  private readonly jobs = new Map<string, ConceptSheetJob>();
  constructor(private readonly now: () => Date = () => new Date()) {}

  /** プロジェクトの最新の生成 (走っている / 失敗した)。成功したものは残さない (シートとして一覧に出る)。 */
  get(projectId: string): ConceptSheetJob | null { return this.jobs.get(projectId) ?? null; }

  /**
   * 受け付けられなければその場で 429 を投げる。task は reject しても外へ投げず、失敗として状態に残す。
   * 戻り値は、結果を状態に残し終えたら解決する (reject しない)。自動更新はこれを待って次のシートへ進む。
   */
  start(projectId: string, sheetId: string, task: () => Promise<void>, trigger: 'manual' | 'auto' = 'manual'): Promise<void> {
    const running = [...this.jobs.values()].filter((j) => j.state === 'running').length;
    if (this.jobs.get(projectId)?.state === 'running' || running >= MAX_PARALLEL) {
      throw new AppError('concept_sheet_generation_busy', 429);
    }
    const startedAt = this.now().toISOString();
    this.jobs.set(projectId, { sheetId, trigger, state: 'running', startedAt });
    // 例外はここで受け止め、unhandled rejection にしない。結果は状態に残し、画面は GET で受け取る。
    return task().then(
      () => { this.jobs.delete(projectId); },
      (error: unknown) => {
        const code = error instanceof AppError ? error.message : 'concept_sheet_generation_failed';
        // 想定外の失敗だけを記録する (AppError は状態として画面に返る)。材料や生成物はログに出さない。
        if (!(error instanceof AppError)) console.error(`[concept-sheet] generation failed for ${sheetId}: ${String(error)}`);
        this.jobs.set(projectId, { sheetId, trigger, state: 'failed', startedAt, finishedAt: this.now().toISOString(), error: code });
      },
    );
  }
}
