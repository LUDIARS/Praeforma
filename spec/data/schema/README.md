# `spec/schema/` — Postgres データモデル

Praeforma backend (`server/src/db/schema/`) の Drizzle テーブル定義に対応する
仕様書。 1 ドメイン 1 ファイル、 [Memoria spec/db/](https://github.com/LUDIARS/Memoria/tree/main/spec/db) と同じ pattern。

## テーブル一覧 (ドメイン別)

| ドメイン | spec | 主テーブル |
|---|---|---|
| プロジェクト / メンバー | [project.md](project.md) | `projects` / `project_members` |
| ドメイン定義 | [domain.md](domain.md) | `domains` |
| オブジェクト | [object.md](object.md) | `objects` / `object_attrs` |
| 配置 (layout / camera) | [layout.md](layout.md) | `layouts` / `layout_objects` / `cameras` |
| 仕様 + acceptance | [spec.md](spec.md) | `specs` / `spec_targets` / `spec_acceptance` |
| アセット | [asset.md](asset.md) | `assets` / `object_assets` |
| acceptance 実行記録 | [acceptance.md](acceptance.md) | `acceptance_runs` / `acceptance_results` |
| コラボ + 監査 | [collab.md](collab.md) | `edit_sessions` / `edit_ops` / `audit_log` |
| 外部 doc 参照 | [reference.md](reference.md) | `references` (= Notion/Confluence/Google 等のリンク) |
| シーン FB / コメント | [feedback.md](feedback.md) | `object_feedback` / `feedback_comments` (Melpomene 互換) |

## 表記

- 主キーは `id` (ULID / `text`)、 タイムスタンプは `timestamptz`
- 外部キー命名: `<table>_id`
- JSON 系は `jsonb`、 enum 系は CHECK + 文字列 (or PostgreSQL enum)
- 各テーブルに `created_at` / `updated_at` (NotNull DEFAULT now()) を持つ
  (= LUDIARS 標準)
- ソフトデリート系列は `deleted_at` (NULL = 生存)。 ハードデリートは row 削除

## マイグレーション

`migrations/NNN_description.sql` に番号付き SQL で配置。
[Cernere の AIFormat ルール](https://github.com/LUDIARS/Cernere/blob/main/CLAUDE.md) に従う:

- `DROP TABLE` / `DROP COLUMN` / `ALTER COLUMN ... TYPE` 禁止
- `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` /
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` を使う
- 冪等性: スキップ可能なエラーコード (42P07 / 42701 等) は runner 側で吸収
