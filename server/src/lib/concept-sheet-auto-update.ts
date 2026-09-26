// 企画概要書の自動更新の予約 (spec/feature/concept-sheet.md PF-CS-11)。
// UX (企画の制約を含む)・仕様・ビジュアルが変わったら、そのプロジェクトを予約する。変更が続く間は待ち、
// 最後の変更から静かな時間 (10 分) が過ぎたら、自動更新 ON で古くなったシートを 1 枚ずつ作り直す (Astra は 1 回数分〜十数分)。
// - 生成の枠 (ConceptSheetJobs) を人の作り直しと共有する。埋まっていれば静かな時間をもう一度待つ (同時には走らせない)。
// - 失敗したシートは、次の変更まで作り直さない (理由は ConceptSheetJobs の状態に残る)。
// - 予約はメモリだけに持つ。再起動で消えるので、起動時に rescheduleOutdated() で予約し直す。stop() でタイマーを解除する。
import { AUTO_UPDATE_QUIET_MS } from '../../../shared/concept-sheet.ts';
import { AppError } from './errors.ts';
import type { ConceptSheetJobs } from './concept-sheet-jobs.ts';

/** 材料が変わったことを知らせる口。routes が呼ぶ。 */
export type MaterialChangeListener = (projectId: string) => void;
export const ignoreMaterialChange: MaterialChangeListener = () => { /* 自動更新を配線しない (テストや単体の router) */ };

export interface AutoUpdateTimers { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void }
/** プロセスを引き留めないタイマー (予約が残っていてもサーバの終了を妨げない)。 */
const nodeTimers: AutoUpdateTimers = {
  set: (fn, ms) => { const timer = setTimeout(fn, ms); timer.unref(); return timer; },
  clear: (handle) => { clearTimeout(handle as ReturnType<typeof setTimeout>); },
};

export interface AutoUpdaterDeps {
  jobs: ConceptSheetJobs;
  /** そのプロジェクトの、自動更新 ON で古くなったシート (古く作った順)。 */
  findTargets: (projectId: string) => Promise<string[]>;
  /** 自動更新 ON で古くなったシートを持つプロジェクト (起動時の予約し直し)。 */
  findOutdatedProjects: () => Promise<string[]>;
  /** 1 枚を作り直して新しい版にする。 */
  regenerate: (projectId: string, sheetId: string) => Promise<void>;
  quietMs?: number;
  now?: () => Date;
  timers?: AutoUpdateTimers;
  warn?: (message: string) => void;
}

export class ConceptSheetAutoUpdater {
  private readonly scheduled = new Map<string, { handle: unknown; dueAt: string }>();
  /** プロジェクトごとの変更の通し番号。失敗の記録と比べ、次の変更が来たら作り直しを再開する。 */
  private readonly changes = new Map<string, number>();
  private readonly failed = new Map<string, Map<string, number>>();
  private stopped = false;
  private readonly timers: AutoUpdateTimers;
  private readonly warn: (message: string) => void;

  constructor(private readonly deps: AutoUpdaterDeps) {
    this.timers = deps.timers ?? nodeTimers;
    this.warn = deps.warn ?? ((message) => console.warn(message));
  }

  /** 材料が変わった。予約を最後の変更から数え直す。 */
  readonly notifyChange: MaterialChangeListener = (projectId) => {
    this.changes.set(projectId, (this.changes.get(projectId) ?? 0) + 1);
    this.arm(projectId);
  };

  /** 予約している時刻 (予約が無ければ null)。 */
  scheduledAt(projectId: string): string | null { return this.scheduled.get(projectId)?.dueAt ?? null; }

  /** 起動時: 自動更新 ON で古いシートを持つプロジェクトを予約し直す。 */
  async rescheduleOutdated(): Promise<void> {
    for (const projectId of await this.deps.findOutdatedProjects()) this.arm(projectId);
  }

  /** サーバ終了時: すべての予約を解除し、以後は予約しない。 */
  stop(): void {
    this.stopped = true;
    for (const { handle } of this.scheduled.values()) this.timers.clear(handle);
    this.scheduled.clear();
  }

  private arm(projectId: string): void {
    if (this.stopped) return;
    const existing = this.scheduled.get(projectId);
    if (existing) this.timers.clear(existing.handle);
    const quietMs = this.deps.quietMs ?? AUTO_UPDATE_QUIET_MS;
    const dueAt = new Date((this.deps.now?.() ?? new Date()).getTime() + quietMs).toISOString();
    const handle = this.timers.set(() => {
      this.scheduled.delete(projectId);
      void this.fire(projectId);
    }, quietMs);
    this.scheduled.set(projectId, { handle, dueAt });
  }

  /** 古いシートを 1 枚作り直し、終われば次へ進む。reject しない (タイマーから呼ぶため)。 */
  private async fire(projectId: string): Promise<void> {
    if (this.stopped) return;
    const seq = this.changes.get(projectId) ?? 0;
    let targets: string[];
    try { targets = await this.deps.findTargets(projectId); } catch (error) {
      this.warn(`[concept-sheet] auto-update lookup failed for ${projectId}: ${String(error)}`);
      return;
    }
    const skipped = this.failed.get(projectId);
    const sheetId = targets.find((id) => skipped?.get(id) !== seq);
    if (!sheetId || this.stopped) return;
    let finished: Promise<void>;
    try {
      finished = this.deps.jobs.start(projectId, sheetId, () => this.deps.regenerate(projectId, sheetId).catch((error: unknown) => {
        this.markFailed(projectId, sheetId, seq);
        throw error;
      }), 'auto');
    } catch (error) {
      // 人の作り直しや別の生成で枠が埋まっている。静かな時間をもう一度待ってから試す。
      if (error instanceof AppError && error.status === 429) { if (!this.scheduled.has(projectId)) this.arm(projectId); return; }
      this.warn(`[concept-sheet] auto-update could not start for ${projectId}: ${String(error)}`);
      return;
    }
    await finished;
    // 走っている間に変更が来ていれば、その予約 (静かな時間の後) に任せる。
    if (!this.scheduled.has(projectId)) await this.fire(projectId);
  }

  private markFailed(projectId: string, sheetId: string, seq: number): void {
    const failed = this.failed.get(projectId) ?? new Map<string, number>();
    failed.set(sheetId, seq);
    this.failed.set(projectId, failed);
  }
}
