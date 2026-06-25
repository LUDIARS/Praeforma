# code-graph — 要件 ↔ 実装処理グラフ (Studio)

要件定義モード (Studio) で、 ドメイン / シーン(=layout) に紐付く要件束を
**MUSA(Thaleia) 経由で Anatomia にリレー**して得た「関連処理グラフ」を保存する。

> Pf × Anatomia = **Thaleia** (企画↔実装トレーサビリティ)。 Praeforma は Anatomia CLI を
> 直叩きせず、 必ず MUSA を経由する (Calliope 注意書き「エンジン二重実装せずバインド/統括」)。
> ドキュメント文脈の主体は Praeforma 側なので、 リレー契約は Praeforma 主導で暫定定義する。

要件本体は既存 `specs` / `spec_acceptance` を再利用する (= 新テーブルを作らない)。
ここで足すのは Anatomia 由来のグラフ (`code_graph_nodes` / `code_graph_edges`) と
リレー実行ログ (`code_graph_runs`) のみ。 migration: `003_studio_code_graph.sql`。

## `code_graph_nodes`

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `target_kind` | `text` | ✓ | — | 要件束の対象。 `domain` / `layout`(=scene) |
| `target_id` | `text` | ✓ | — | `domains.id` / `layouts.id` |
| `node_key` | `text` | ✓ | — | Anatomia の安定キー (symbol path 等)。 upsert に使う |
| `label` | `text` | ✓ | — | 表示名 |
| `node_type` | `text` | ✓ | `'symbol'` | `symbol` / `file` / `domain` / `spec` / `external` |
| `anatomia_ref` | `jsonb` | ✓ | `'{}'` | Anatomia ノードの生ペイロード (domain/layer/path 等) |
| `source` | `text` | ✓ | `'anatomia'` | `anatomia` / `manual` (グラフ調整で人が足した) |
| `status` | `text` | ✓ | `'linked'` | `linked` / `candidate` / `dismissed` (調整時に除外) |
| `meta` | `jsonb` | ✓ | `'{}'` | 任意メタ |
| `created_at` / `updated_at` | `timestamptz` | ✓ | `now()` | — |

### Constraint / Index
- UNIQUE (`project_id`, `target_kind`, `target_id`, `node_key`) — リンク再実行時の upsert キー
- CHECK `target_kind IN ('domain','layout')` / `node_type IN (...)` / `source IN (...)` / `status IN (...)`
- `idx_code_graph_nodes_target` (`project_id`, `target_kind`, `target_id`)

## `code_graph_edges`

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `target_kind` / `target_id` | `text` | ✓ | — | nodes と同じ対象キー |
| `from_node` / `to_node` | `text` | ✓ | — | FK `code_graph_nodes.id` |
| `relation` | `text` | ✓ | `'related'` | `calls` / `depends` / `implements` / `related` |
| `source` | `text` | ✓ | `'anatomia'` | `anatomia` / `manual` |
| `meta` | `jsonb` | ✓ | `'{}'` | — |
| `created_at` | `timestamptz` | ✓ | `now()` | — |

### Constraint / Index
- UNIQUE (`from_node`, `to_node`, `relation`) — リレー再実行で重複させない (`onConflictDoNothing`)
- CHECK `relation IN (...)` / `source IN (...)`
- `idx_code_graph_edges_target` (`project_id`, `target_kind`, `target_id`)

## `code_graph_runs`

MUSA(Thaleia)→Anatomia リレー 1 回 = 1 run。 企画↔実装トレーサビリティのため、
いつ・どの要件束で・何を引いたかを残す。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` / `target_kind` / `target_id` | `text` | ✓ | — | 対象 |
| `query` | `text` | ✓ | `''` | リレーに渡した検索クエリ |
| `status` | `text` | ✓ | `'ok'` | `ok` / `error` / `musa_unconfigured` |
| `node_count` / `edge_count` | `integer` | ✓ | `0` | upsert 件数 |
| `summary` | `text` |  | NULL | MUSA からの要約 |
| `raw` | `jsonb` | ✓ | `'{}'` | リレー応答 (失敗時は error detail) |
| `requested_by` | `text` | ✓ | — | Cernere user UUID |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
