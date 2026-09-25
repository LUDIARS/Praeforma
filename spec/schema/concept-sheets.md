# concept_sheets（企画概要書）

[spec/feature/concept-sheet.md](../feature/concept-sheet.md) の保存先。1 行 = 企画概要書 1 枚。

| 列 | 型 (Postgres / SQLite) | 内容 |
|---|---|---|
| id | text PK | 画面が作る UUID（作成の冪等性と版一致のため） |
| project_id | text NOT NULL → projects(id) | 所属プロジェクト |
| payload | jsonb / TEXT(JSON) | `{document, keyVisual, source, status}`（下記） |
| revision | integer NOT NULL | 作成で 1、更新ごとに +1。版一致の比較に使う |
| updated_at | timestamptz / INTEGER(ms) | 最終更新 |

索引: `idx_concept_sheets_project(project_id)`。

payload:

- `document`: 読み手に見せる文だけ（`ConceptSheetDocument`、各欄に字数の上限）。
- `keyVisual`: `{dataUrl, mimeType, digest}` または null。画像の実体は 4MB まで（data URL で約 5.4MB）。
  一覧 API は画像を返さない。
- `source`: `{uxGoalRevision, uxDigest, keyVisualDigest, skillDigest}`。uxDigest はプロジェクト名と UX/ゴール 5 欄の SHA-256 で、鮮度の判定に使う。
- `status`: `generated`（AI が作成）/ `edited`（人が修正）。

移行: Postgres は `server/migrations/018_concept_sheets.sql`（CREATE TABLE IF NOT EXISTS）、SQLite は起動時の DDL
（`server/src/db/concept-sheet-sqlite.ts`）。追加のみで既存資料を変えない。

関連: UX/ゴールの追加欄 `projects.ux_story` / `projects.ux_emotions` は migration 017
（[project-ux-goal.md](../feature/project-ux-goal.md) PF-GOAL-W2）。
