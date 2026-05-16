# acceptance — テスト実行記録

[§11 acceptance test 詳細](../praeforma.md#11-acceptance-test-の詳細) の
「runtime probe による検査結果」 の永続化。 spec_acceptance 行に対する
1 回 1 回の評価結果を残す。

## `acceptance_runs`

1 回のテスト実行 = 1 run (= 「2026-05-16 14:00 に main layout を web で回した」)。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `layout_id` | `text` | ✓ | — | FK `layouts.id` (= 評価した scene) |
| `platform` | `text` | ✓ | — | `web` / `unity` / `2d-web` 等 |
| `trigger` | `text` | ✓ | `'manual'` | `manual` / `file-save` / `cron` / `ci` |
| `seed` | `text` |  | NULL | 乱数 seed (= 再現性のため) |
| `started_at` | `timestamptz` | ✓ | `now()` | — |
| `finished_at` | `timestamptz` |  | NULL | NULL = 実行中 |
| `status` | `text` | ✓ | `'running'` | `running` / `passed` / `failed` / `error` / `aborted` |
| `summary` | `jsonb` | ✓ | `'{}'` | `{pass: 12, fail: 3, skip: 0, error: 0}` 等の集計 |
| `triggered_by` | `text` |  | NULL | Cernere user UUID (= 手動実行時) |

### Constraint
- CHECK `platform IN ('web','unity','webgl','2d-web')`
- CHECK `trigger IN ('manual','file-save','cron','ci')`
- CHECK `status IN ('running','passed','failed','error','aborted')`

### Index
- `idx_acceptance_runs_project` (`project_id`, `started_at` DESC)
- `idx_acceptance_runs_layout` (`layout_id`, `started_at` DESC)

## `acceptance_results`

run × spec_acceptance 行 1 件ずつ。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `bigserial` | ✓ | — | PK |
| `run_id` | `text` | ✓ | — | FK `acceptance_runs.id` |
| `acceptance_id` | `text` | ✓ | — | FK `spec_acceptance.id` |
| `status` | `text` | ✓ | — | `pass` / `fail` / `skip` / `error` |
| `observed` | `jsonb` |  | NULL | 失敗時の観測値 dump (debug 用) |
| `error_message` | `text` |  | NULL | error 時の例外メッセージ |
| `log_excerpt` | `text` |  | NULL | 関連 log 1 KB 程度 |
| `started_at` | `timestamptz` | ✓ | `now()` | — |
| `duration_ms` | `integer` | ✓ | `0` | 評価所要時間 |

### Constraint
- UNIQUE (`run_id`, `acceptance_id`)
- CHECK `status IN ('pass','fail','skip','error')`

### Index
- `idx_acceptance_results_run` (`run_id`)
- `idx_acceptance_results_acceptance` (`acceptance_id`, `started_at` DESC)
  — 「この acceptance の最近の傾向」 を引く

## 保持ポリシー

- `acceptance_runs` / `acceptance_results` は project 設定で retention 期間を
  決める (= デフォルト 90 日)
- retention を超えたら cron で物理削除 (= log 系なので audit_log には残さない)
- 集計値 (`summary`) は trends 用に別テーブル `acceptance_daily_stats` に
  日次 rollup する (= v2 で導入)
