# ux-design schema

Migration: `server/migrations/006_ux_core_design.sql`

## Aggregate

`ux_scenarios` が UX 設計の集約 root。`ux_use_cases`、`ux_canvases`、解析、候補、判断、証拠は
scenario に属する。domain id や scene-domain join は保持しない。

| Table | Purpose | Concurrency |
|---|---|---|
| `ux_scenarios` | actor / context / goal / success を保存 | `revision` CAS |
| `ux_use_cases` | intent / trigger / success / failure / recovery | `revision` CAS |
| `ux_canvases` | frame / element / transition JSON | `revision` CAS |
| `ux_analysis_runs` | LLM + Anatomia + Genius 入力 snapshot | scenario/use-case revision snapshot |
| `ux_boundary_proposals` | 未承認の境界候補 | immutable proposal revision |
| `ux_boundary_decisions` | 人間の採否・修正・分割・統合 | UNIQUE(proposal, proposal revision) |
| `ux_evidence` | 実装・テスト・Anatomia の版付き証拠 | target + provenance UNIQUE |
| `ux_image_analyses` | 原画像を除く解析候補と fingerprint | canvas base revision |

## Snapshot rules

`ux_analysis_runs` は `scenario_revision` と `use_case_revisions` を保持する。解析完了時と人間判断時に
現行版へ照合し、変化していた場合は `ux_analysis_stale` とする。候補の `use_case_ids` は解析入力集合、
`existing_domain_refs` は同時取得した Anatomia domain 集合に含まれなければならない。

判断は proposal を更新せず append-only で記録する。proposal status は最新判断から投影する。
ただし status が accepted でも、入力 scenario/use-case の Pf 仕様版が現行版と異なる候補は
`isCurrent=false` とし、現在有効な境界として扱わない。reject の `result_boundaries` は空であり、
境界定義には利用しない。
これにより SQLite と PostgreSQL の transaction 実装差で判断履歴だけ残る状態を避ける。

scenario と初期 canvas、解析候補群と run 完了は dialect ごとの transaction でまとめる。
SQLite は同期 transaction 内で同期 SQL だけを実行する。

## Canvas JSON

frame は `description` と `states[] { id, name, condition, content }` を持つ。element の `dynamic` と
`follow` は nullable。canvas に domain 参照を追加してはならない。

`applied_image_analysis_ids` は同じ画像解析候補の二重適用を防ぐ。

## Evidence freshness

`isStale` は evidence が記録した Praeforma の scenario/use-case/canvas 版と、現在の Pf 仕様版の
不一致を表す。Anatomia evidence の `source_revision` は取得時の graph payload の SHA-256 snapshot
であり、参照コードの最新 commit、実装完了、テスト成功を証明する値ではない。これらは別の
implementation/test evidence として明示的に登録する。
