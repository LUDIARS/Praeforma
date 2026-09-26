# concept_sheets / concept_sheet_versions（企画概要書と版）

[spec/feature/concept-sheet.md](../feature/concept-sheet.md) の保存先。

## concept_sheets

1 行 = 企画概要書 1 枚の最新版（一覧・版一致・自動更新の ON/OFF に使う）。

| 列 | 型 (Postgres / SQLite) | 内容 |
|---|---|---|
| id | text PK | 画面が作る UUID（作成の冪等性と版一致のため） |
| project_id | text NOT NULL → projects(id) | 所属プロジェクト |
| payload | jsonb / TEXT(JSON) | 最新版の `{design, source, visualRefs}`（下記）。migration 021 より前の行は `{design, images, source}` |
| revision | integer NOT NULL | 作成で 1、作り直し・自動更新ごとに +1。版一致の比較に使う（版の番号 rv とは別に数える） |
| updated_at | timestamptz / INTEGER(ms) | 最終更新 |
| auto_update | boolean / INTEGER NOT NULL DEFAULT true(1) | 自動更新の ON/OFF（PF-CS-11）。変えても revision は進めない（migration 021） |
| latest_rv | integer NOT NULL DEFAULT 1 | 最新版の番号。既存の行は 1（= 引き継いだ rv1）（migration 021） |

索引: `idx_concept_sheets_project(project_id)`。

payload:

- `design`: Astra が設計した 1 枚（`ConceptSheetDesign`）。`{title, catchcopy, concept, scene:{index,label,reason}, sections, html}`。
  html の画像は `{{IMAGE_n}}` の差し込み口で持ち、表示・出力の直前に画像の data URL を埋める。html は 300KB まで。
  scene.label は人が付けた候補の名前（Astra の書いた名前ではない）。
- `source`: `{uxGoalRevision, uxDigest, specDigest, imagesDigest, skillDigest, model, instructions}`。uxDigest はプロジェクト名・
  キャッチコピーの文言・UX の文章欄 (ターゲット・ジャーニー・詳細 4 欄)・コアドメインの価値・企画の制約の SHA-256。
  specDigest は材料に入れた仕様（見出し・分類・状態）の SHA-256（Astra に渡した、生成を始めたときのもの）。どちらも鮮度の判定に使う。
  キャッチコピーを AI案 で埋めたときは、uxDigest を埋めた後の値で計算する。specDigest の無い版は仕様を反映していないので古いと扱う。
- `visualRefs`: 使ったビジュアル `[{visualId, digest, kind, label, note}]`（添字が `{{IMAGE_n}}`、1〜6 枚）。label / kind / note は版を作ったときのもの。
- `images`（migration 021 より前の行だけ）: 画面の候補 `[{label, dataUrl, mimeType, digest}]`。一覧 API は返さない。

形の変更（2026-09-26）: 初版の `{document, keyVisual, source, status}` から替えた。旧形式の行は読まない（一覧・取得の対象外）。
変更時点で旧形式の行は 0 件（唯一の稼働先であるローカルモードで確認）。
同日の migration 021 以降に書く行は `images` を持たず `visualRefs` を持つ。旧コードは `images` の無い行を読めないので、
新しい形の行を書く前に旧サーバを入れ替える。

## concept_sheet_versions（migration 021）

1 行 = 企画概要書の 1 つの版。作成が rv1、作り直し・自動更新のたびに rv を 1 つ進めて足す。版は全部残す（PF-CS-10）。
最新版の行（concept_sheets）と同じトランザクションで書く。

| 列 | 型 (Postgres / SQLite) | 内容 |
|---|---|---|
| sheet_id | text NOT NULL → concept_sheets(id) ON DELETE CASCADE | 企画概要書（SQLite は FK を強制しないので、削除時に版も消す） |
| rv | integer NOT NULL | 版の番号。PK は (sheet_id, rv) |
| project_id | text NOT NULL → projects(id) | 所属プロジェクト |
| payload | jsonb / TEXT(JSON) | `{design, source}`。migration 021 で写した rv1 は `{design, images, source}`（行の中身そのまま） |
| visual_refs | jsonb / TEXT(JSON) NOT NULL DEFAULT '[]' | 使ったビジュアル `[{visualId, digest, kind, label, note}]`。写した rv1 は空 |
| kind | text NOT NULL | `create` / `regenerate` / `auto` / `migrated` |
| created_by | text NOT NULL | 作った利用者（Cernere user UUID）。自動更新は `system:concept-sheet-auto-update`、写した rv1 は `migration:021` |
| created_at | timestamptz / INTEGER(ms) | 版を作った日時（写した rv1 は元の行の updated_at） |

索引: `idx_concept_sheet_versions_project(project_id)`。

### 版の画像を複製しない理由と、古い版の画像を残す方法

版は画像そのものを持たず、使ったビジュアル（project_visuals、[project-visuals.md](project-visuals.md)）の id と中身の digest を持つ。
同じ候補で作り直し・自動更新を重ねても画像は 1 枚分だけで済む（1 枚 4MB まで × 6 枚 × 版の数、にならない）。

表示するときは、ビジュアルの今の中身ではなく版を作ったときの中身が要る。そこで:

- ビジュアルの画像は登録後に変えない（PF-VIS-2）。id が同じなら中身も同じで、digest で確かめられる（違えばその画像は埋めない）。
- どれかの版が使ったビジュアルを削除するときは、行を消さず削除済みの印（deleted_at）を付けて画像を残す（PF-VIS-4）。
  タブや候補には出さないが、版の表示だけはその行から画像を引く。どの版も使っていなければ行ごと消す。
- 企画概要書を消して版が無くなったら、どの版も使わなくなった削除済みの行を片付ける。

版ごとに画像を写す方法（画像を版に複製）と比べ、容量が版の数に比例して増えない。content-addressed な画像の表を別に持つ方法と比べ、
表が 1 つで済み、ビジュアルの削除の可否を「版が使っているか」だけで決められる。

### 移行

- Postgres: `server/migrations/021_concept_sheet_versions_and_visuals.sql`（CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS）。
  同じ migration で、版の無い既存の行をその内容のまま rv1（kind `migrated`）として写す（`INSERT … SELECT … WHERE NOT EXISTS`）。
- SQLite: 起動時の DDL・列の追加（`server/src/db/concept-sheet-sqlite.ts`）と、同じ冪等な写し（`CONCEPT_SHEET_BACKFILLS`、列の追加の後）。
- 追加の表・列のみで、既存の行は変えない（018 は `server/migrations/018_concept_sheets.sql`）。

関連: UX/ゴールの追加欄 `projects.ux_story` / `projects.ux_emotions` は migration 017（PF-GOAL-W2）、
`projects.ux_catchcopy` / `projects.ux_catchcopy_origin` は migration 019（PF-GOAL-W3、[project-ux-goal.md](../feature/project-ux-goal.md)）。
ビジュアル素材の表 `project_visuals` も migration 021（[project-visuals.md](project-visuals.md)）。
