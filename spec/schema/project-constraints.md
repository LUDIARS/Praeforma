# project_constraints（プロジェクトの制約）

[spec/feature/project-constraints.md](../feature/project-constraints.md) の保存先。1 行 = 制約 1 件。

| 列 | 型 (Postgres / SQLite) | 内容 |
|---|---|---|
| id | text PK | ULID |
| project_id | text NOT NULL → projects(id) | 所属プロジェクト |
| kind | text NOT NULL | `planning`（企画）/ `technical`（技術）/ `other`（運用・その他） |
| title | text NOT NULL | 見出し（1 行・80 字まで） |
| detail | text NOT NULL DEFAULT '' | 説明（4000 字まで） |
| revision | integer NOT NULL DEFAULT 1 | 作成で 1、更新ごとに +1。版一致の比較に使う |
| created_by | text NOT NULL | 作成した利用者（Cernere user UUID） |
| created_at / updated_at | timestamptz / INTEGER(ms) | 作成・最終更新 |

索引: `idx_project_constraints_project(project_id)`。

移行: Postgres は `server/migrations/020_project_target_and_constraints.sql`（CREATE TABLE IF NOT EXISTS）、
SQLite は起動時の DDL（`server/src/db/project-constraint-sqlite.ts`）。追加のみで既存資料を変えない。
同じ migration で `projects.ux_target`（ターゲットユーザー、PF-GOAL-W4）を足す。
