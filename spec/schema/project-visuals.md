# project_visuals（ビジュアル素材）

[spec/feature/project-visuals.md](../feature/project-visuals.md) の保存先。1 行 = ビジュアル 1 枚。

| 列 | 型 (Postgres / SQLite) | 内容 |
|---|---|---|
| id | text PK | ULID |
| project_id | text NOT NULL → projects(id) | 所属プロジェクト |
| kind | text NOT NULL | `key_visual`（キービジュアル）/ `concept_art`（コンセプトアート）/ `screenshot`（スクリーンショット） |
| label | text NOT NULL | 名前（1 行・60 字まで） |
| note | text NOT NULL DEFAULT '' | メモ（1000 字まで） |
| featured | boolean / INTEGER NOT NULL DEFAULT false(0) | 一押し |
| mime_type | text NOT NULL | `image/png` / `image/jpeg` / `image/webp` |
| byte_size | integer NOT NULL | 画像の大きさ（バイト、4MB まで） |
| digest | text NOT NULL | 画像の中身の SHA-256。企画概要書の版はこれで「版を作ったときの中身」を確かめる |
| data_url | text NOT NULL | 画像（`data:<mime>;base64,…`）。assets の保存先は仮実装で画像を置けないため DB に持つ。登録後に変えない |
| revision | integer NOT NULL DEFAULT 1 | 作成で 1、更新ごとに +1。版一致の比較に使う |
| created_by | text NOT NULL | 登録した利用者（Cernere user UUID） |
| created_at / updated_at | timestamptz / INTEGER(ms) | 登録・最終更新 |
| deleted_at | timestamptz / INTEGER(ms) NULL | 削除済みの印。企画概要書の版が使うものは削除しても行を残し、これを付ける（PF-VIS-4） |

索引: `idx_project_visuals_project(project_id)`。

1 プロジェクト 30 枚まで（deleted_at の無い行を数える、登録の INSERT の中で確かめる）。
一覧は data_url を読まない（`server/src/db/project-visual-reads.ts`）。
版が使っているかは `concept_sheet_versions.visual_refs` の visualId で判定する（[concept-sheets.md](concept-sheets.md)）。

移行: Postgres は `server/migrations/021_concept_sheet_versions_and_visuals.sql`（CREATE TABLE IF NOT EXISTS）、
SQLite は起動時の DDL（`server/src/db/project-visual-sqlite.ts`）。追加のみで既存資料を変えない。
