# ローカルモード — 仕様書レビュー用の単体起動

Praeforma を **Postgres も Cernere も無しで** ローカル単体起動するモード。
用途は「仕様書(ドメイン/要件)のレビュー」。 認証・個人特定は不要なので持たない。

## 起動

```sh
npm run local      # = build:web + server を LOCAL_MODE で起動 (port 8889)
# → http://localhost:8889/ を開く (UI も同一オリジンで配信、 ログイン不要)
```

`PRAEFORMA_LOCAL_DB` (既定 `.praeforma-local/praeforma.sqlite`) に SQLite で永続化。

## 仕組み (最小実装)

| 観点 | 通常 (本番) | ローカルモード |
|---|---|---|
| 永続化 | Postgres (`pg`) | **SQLite** (`better-sqlite3`)。 起動時に DDL を流す |
| スキーマ | `pgTable` (全テーブル) | Studio 最小サブセット 15 テーブルを `sqliteTable` で並行定義 (`db/sqlite-schema.ts`)。 各 schema ファイルが `LOCAL_MODE` 時に sqlite 版を pg 型へキャストして再エクスポート → **ルートは無改変** |
| 認証 | Cernere PASETO V4 | **バイパス**: 固定の匿名ローカルユーザ (`local-reviewer` / owner) を注入。 個人データ無し |
| ルート | 全部 | サブセット (projects/domains/objects/layouts/specs/assets/studio)。 references/feedback/acceptance/WS collab は非搭載 |
| フロント | Cernere popup login | `/api/health` が `localMode` を返したら token を自動セット → ログイン省略 |

`PRAEFORMA_LOCAL_MODE` 未設定なら **完全に従来通り** (Postgres + Cernere)。 本番パスは不変。

## SQLite 化したテーブル (15)

projects / project_members / domains / objects / object_attrs / assets / object_assets /
layouts / specs / spec_targets / spec_acceptance / code_graph_nodes / code_graph_edges /
code_graph_runs / audit_log。

型対応: `jsonb→text{json}` / `timestamptz→integer{timestamp_ms}` / `bigserial→integer
autoincrement` / `boolean→integer{boolean}`。

## 制限 (現フェーズ)

- レイアウトの空間配置 (layout_objects/cameras) は非サブセット → `GET /layouts/:id` 等は非対応。
- Studio の `suggest` は `claude -p`、 `anatomia-link` は MUSA(Thaleia) が必要 (未設定なら明示エラー)。
- 単一利用前提 (WS collab 無し)。
