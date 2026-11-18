// ダッシュボードの「最近の出来事」 — spec/feature/project-dashboard.md。
// 断片の登録 (spec_fragments)・仕様の版 (spec_version_logs)・操作記録 (audit_log) を時刻順に 1 本へまとめる。
// DB を読まない純関数。保存形式の違い (SQLite は ms 整数 / ISO 文字列、PostgreSQL は Date) をここで揃える。

import { AppError } from './errors.ts';
import type { ProjectEvent, ProjectEventKind, ProjectEventTargetKind } from '../../../shared/project-home.ts';

export type { ProjectEvent, ProjectEventKind };


export interface FragmentEventRow { id: unknown; content: unknown; source: unknown; created_by: unknown; created_at: unknown }
export interface VersionEventRow { id: unknown; version: unknown; kind: unknown; created_at: unknown }
export interface AuditEventRow { id: unknown; action: unknown; target_kind: unknown; target_id: unknown; actor_display_name: unknown; actor_user_id: unknown; created_at: unknown }

/** ダッシュボードに出す操作記録。ここに無い操作 (設定変更など) は出さない。 */
export const DASHBOARD_AUDIT_ACTIONS: Readonly<Record<string, { kind: ProjectEventKind; title: string }>> = {
  'scene.save': { kind: 'scene', title: 'シーンを編集' },
  'layout.create': { kind: 'scene', title: 'シーンを追加' },
  'layout.update': { kind: 'scene', title: 'シーンを更新' },
  'layout.delete': { kind: 'scene', title: 'シーンを削除' },
  'layout.placements_replace': { kind: 'scene', title: 'シーンの配置を変更' },
  'transition.create': { kind: 'transition', title: '遷移を追加' },
  'transition.update': { kind: 'transition', title: '遷移を更新' },
  'transition.delete': { kind: 'transition', title: '遷移を削除' },
  'spec.create': { kind: 'spec', title: '体系仕様を追加' },
  'spec.update': { kind: 'spec', title: '体系仕様を更新' },
  'spec.delete': { kind: 'spec', title: '体系仕様を削除' },
  'spec.targets_replace': { kind: 'spec', title: '仕様の対象を変更' },
  'object.create': { kind: 'actor', title: 'アクターを追加' },
  'object.update': { kind: 'actor', title: 'アクターを更新' },
  'object.delete': { kind: 'actor', title: 'アクターを削除' },
};

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/** `?limit` を読む。既定 30、上限 100。 */
export function parseEventLimit(value: string | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw AppError.badRequest('invalid_limit');
  return Math.min(n, MAX_LIMIT);
}

const TARGET_KINDS = new Set(['fragment', 'spec', 'layout', 'transition', 'object']);
const SNIPPET = 80;

/** 時刻を ISO 文字列へ。読めない値は null (その行は捨てる)。 */
export function toIso(value: unknown): string | null {
  const date = value instanceof Date ? value
    : typeof value === 'number' ? new Date(value)
    : typeof value === 'string' && /^\d+$/.test(value) ? new Date(Number(value))
    : typeof value === 'string' ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
function snippet(value: unknown): string | null {
  const text = str(value)?.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > SNIPPET ? `${text.slice(0, SNIPPET)}…` : text;
}

export function mergeProjectEvents(input: {
  fragments: FragmentEventRow[]; versions: VersionEventRow[]; audits: AuditEventRow[]; limit: number;
}): ProjectEvent[] {
  const events: ProjectEvent[] = [];
  for (const row of input.fragments) {
    const at = toIso(row.created_at); const id = str(row.id);
    if (!at || !id) continue;
    events.push({ id: `fragment:${id}`, kind: 'fragment', at, title: '断片を追加', detail: snippet(row.content),
      actor: str(row.source) ?? str(row.created_by), target: { kind: 'fragment', id } });
  }
  for (const row of input.versions) {
    const at = toIso(row.created_at); const id = str(row.id);
    if (!at || !id) continue;
    const version = str(row.version);
    events.push({ id: `version:${id}`, kind: 'systematize', at,
      title: row.kind === 'reconstruction' ? '断片を体系化' : '仕様の版を記録',
      detail: version ? `v${version}` : null, actor: null, target: null });
  }
  for (const row of input.audits) {
    const at = toIso(row.created_at); const action = str(row.action);
    const mapped = action ? DASHBOARD_AUDIT_ACTIONS[action] : undefined;
    if (!at || !mapped) continue;
    const targetKind = str(row.target_kind); const targetId = str(row.target_id);
    events.push({ id: `audit:${String(row.id)}`, kind: mapped.kind, at, title: mapped.title, detail: null,
      actor: str(row.actor_display_name) ?? str(row.actor_user_id),
      target: targetKind && targetId && TARGET_KINDS.has(targetKind)
        ? { kind: targetKind as ProjectEventTargetKind, id: targetId } : null });
  }
  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1)).slice(0, input.limit);
}
