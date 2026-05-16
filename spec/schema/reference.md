# reference — 外部ドキュメント参照リンク

ドメイン (および任意で project / object / spec) に対して、 Notion / Confluence /
Google Docs 等の外部資料をリンクできる。 Praeforma 内では URL + 表示名 +
種別を持つだけのシンプルな構造で、 実コンテンツの取り込みは optional。

## 動機

- ドメイン定義の補助資料 (= デザイン仕様書 / 既存のドキュメント) を
  Praeforma 内で参照したい
- 既存資料の二重管理を避けるため、 Praeforma に転記せず **元の場所** を
  参照する
- Unity Editor / Web どちらからも同じ参照を扱える

## 表示方針 (3 段階)

| モード | 内容 | 適用条件 |
|--------|------|---------|
| **link** | URL を OS ブラウザで開く | 既定、 全 kind で動く |
| **webview** | アプリ内 WebView で埋め込み表示 | Web は iframe、 Unity は WebView パッケージ前提 |
| **markdown** | API から取得して Markdown レンダリング | Notion API / Google Docs API の token が登録されている時のみ |

v0.1 では **link モードのみ実装** (= 「難しければ Web のリンクにする」 に相当)。
webview / markdown は kind / token が揃った段階で順次。

## `external_references` (DB 上のテーブル名、 SQL 予約語回避)

> spec / UI / コード変数では `references` の名前を使うが、 DB テーブル名のみ
> `external_references` (= PostgreSQL の予約語 `REFERENCES` との衝突回避)。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `target_kind` | `text` | ✓ | — | `domain` / `project` / `object` / `spec` |
| `target_id` | `text` | ✓ | — | 対象行の id |
| `kind` | `text` | ✓ | `'web'` | `notion` / `confluence` / `google-docs` / `google-sheet` / `web` / `figma` / `github` |
| `url` | `text` | ✓ | — | リンク先 URL |
| `title` | `text` | ✓ | — | 表示名 (短) |
| `description` | `text` |  | NULL | 補足 |
| `display_mode` | `text` | ✓ | `'link'` | `link` / `webview` / `markdown` (v0.1 は link のみ実装) |
| `ordinal` | `integer` | ✓ | `0` | 表示順 |
| `created_by` | `text` | ✓ | — | Cernere user UUID |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |

### Constraint

- CHECK `target_kind IN ('domain','project','object','spec')`
- CHECK `kind IN ('notion','confluence','google-docs','google-sheet','web','figma','github')`
- CHECK `display_mode IN ('link','webview','markdown')`

### Index

- `idx_references_target` (`target_kind`, `target_id`) — 「この domain の refs 一覧」
- `idx_references_project` (`project_id`)

## URL 種別の判定 (= kind 自動推定)

UI で URL を入力したとき、 ホスト名で kind をデフォルト推定する:

| 含む文字列 | 既定 kind |
|---|---|
| `notion.so` / `notion.site` | `notion` |
| `atlassian.net/wiki` / `confluence` | `confluence` |
| `docs.google.com/document` | `google-docs` |
| `docs.google.com/spreadsheet` | `google-sheet` |
| `figma.com` | `figma` |
| `github.com` | `github` |
| その他 | `web` |

ユーザは UI で override 可能。

## 権限

- list / read: project member (= role `viewer` 以上)
- create: `owner` / `planner` (= ドメイン定義を編集できる人)
- delete: `owner` / `planner`

## v0.2+ 拡張

- **webview モード**:
  - Web 側: iframe 埋め込み (X-Frame-Options 制約に注意、 Notion は基本不可)
  - Unity 側: vuplex 3D WebView 等のパッケージを option 化
- **markdown モード**:
  - Notion: `https://api.notion.com/v1/pages/{page_id}` (= integration token 必要)
  - Google Docs: `https://docs.googleapis.com/v1/documents/{doc_id}` (= OAuth token 必要)
  - 取得結果は `reference_cache` テーブルに 24h キャッシュ
- **同期**: 元 doc が更新されたら `reference_cache.fetched_at` を invalidate

## 関連

- §F2 ドメイン定義 (praeforma.md)
- Unity Editor 拡張側からは `Application.OpenURL(url)` で OS ブラウザ起動
- Web 側は `<a href target="_blank">` で別タブ
