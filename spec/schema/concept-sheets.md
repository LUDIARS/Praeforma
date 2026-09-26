# concept_sheets（企画概要書）

[spec/feature/concept-sheet.md](../feature/concept-sheet.md) の保存先。1 行 = 企画概要書 1 枚。

| 列 | 型 (Postgres / SQLite) | 内容 |
|---|---|---|
| id | text PK | 画面が作る UUID（作成の冪等性と版一致のため） |
| project_id | text NOT NULL → projects(id) | 所属プロジェクト |
| payload | jsonb / TEXT(JSON) | `{design, images, source}`（下記） |
| revision | integer NOT NULL | 作成で 1、更新ごとに +1。版一致の比較に使う |
| updated_at | timestamptz / INTEGER(ms) | 最終更新 |

索引: `idx_concept_sheets_project(project_id)`。

payload:

- `design`: Astra が設計した 1 枚（`ConceptSheetDesign`）。`{title, catchcopy, concept, scene:{index,label,reason}, sections, html}`。
  html の画像は `{{IMAGE_n}}` の差し込み口で持ち、表示・出力の直前に images の data URL を埋める。html は 300KB まで。
  scene.label は人が付けた候補の名前（Astra の書いた名前ではない）。
- `images`: 画面の候補 `[{label, dataUrl, mimeType, digest}]`（1〜6 枚、1 枚 4MB・合計 16MB まで）。一覧 API は返さない。
- `source`: `{uxGoalRevision, uxDigest, imagesDigest, skillDigest, model, instructions}`。uxDigest はプロジェクト名・キャッチコピーの文言・
  UX の文章欄 (ターゲット・ジャーニー・詳細 4 欄)・コアドメインの価値・企画の制約の SHA-256 で、鮮度の判定に使う。キャッチコピーを AI案 で埋めたときは、埋めた後の値で計算する。

形の変更（2026-09-26）: 初版の `{document, keyVisual, source, status}` から替えた。旧形式の行は読まない（一覧・取得の対象外）。
変更時点で旧形式の行は 0 件（唯一の稼働先であるローカルモードで確認）。表の列は変えていないので migration は無い。

移行: Postgres は `server/migrations/018_concept_sheets.sql`（CREATE TABLE IF NOT EXISTS）、SQLite は起動時の DDL
（`server/src/db/concept-sheet-sqlite.ts`）。追加のみで既存資料を変えない。

関連: UX/ゴールの追加欄 `projects.ux_story` / `projects.ux_emotions` は migration 017（PF-GOAL-W2）、
`projects.ux_catchcopy` / `projects.ux_catchcopy_origin` は migration 019（PF-GOAL-W3、[project-ux-goal.md](../feature/project-ux-goal.md)）。
