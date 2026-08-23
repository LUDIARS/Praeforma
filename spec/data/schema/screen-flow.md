# schema: screen-flow — 画面遷移 / LLM 会話 / Cc 接続

[feature/screen-flow.md](../../feature/screen-flow.md) §3 の正本。 migration `004_screen_flow.sql`。

## transitions — UI 要素起点の画面遷移

| 列 | 型 | NULL | 既定 | 意味 |
|---|---|---|---|---|
| id | text (ULID) | no | | PK |
| project_id | text | no | | FK `projects.id` |
| from_layout_id | text | no | | FK `layouts.id` 遷移元画面 |
| source_object_id | text | yes | | FK `layout_objects.id` 起点 UI 要素 (= 画面上の配置)。 null は画面起因 |
| to_layout_id | text | no | | FK `layouts.id` 遷移先画面 |
| trigger | text | no | `'tap'` | `tap` / `submit` / `timeout` / `event:<name>` |
| condition | text | no | `''` | 分岐条件 (自由文)。 空文字 = 条件なし |
| label | text | yes | | 遷移図の辺ラベル (空なら合成) |
| ordinal | int | no | 0 | 同一起点内の表示順 |
| version | int | no | 1 | 楽観ロック |
| created_at / updated_at | timestamptz | no | now | |

- UNIQUE (`source_object_id`, `condition`) — 起点ありの重複防止
- 部分 UNIQUE (`from_layout_id`, `trigger`, `condition`) WHERE `source_object_id IS NULL`
- サーバ検証: `from_layout_id` = `layout_objects.layout_id`、 全 FK が同一 `project_id`

## spec_conversations / spec_messages — LLM トークエリア

### spec_conversations

| 列 | 型 | NULL | 意味 |
|---|---|---|---|
| id | text (ULID) | no | PK |
| project_id | text | no | FK |
| target_kind | text | no | CHECK `project|domain|layout|object|transition` |
| target_id | text | no | 対象 id (project のときは project_id) |
| title | text | yes | |
| created_by | text | no | Cernere user id |
| created_at / updated_at | timestamptz | no | |

UNIQUE (`project_id`, `target_kind`, `target_id`) — 対象 1 つにつき会話 1 本。

### spec_messages

| 列 | 型 | NULL | 既定 | 意味 |
|---|---|---|---|---|
| id | text (ULID) | no | | PK |
| conversation_id | text | no | | FK `spec_conversations.id` |
| role | text | no | | CHECK `user|assistant|system` |
| content | text | no | | Markdown 本文 |
| proposals | jsonb | no | `'[]'` | 提案配列 (feature §5.3)。 各要素は反映済みの印 `applied?: boolean` を持つ |
| applied | boolean | no | false | 提案を 1 つ以上反映したか (個別の反映状態は `proposals[].applied`) |
| created_at | timestamptz | no | now | |

`applied` は message 単位の粗い印なので、 再反映の可否は `proposals[].applied` で判定する
(message 単位だけだと 「1 件目を反映したら残りも反映済み扱い」 か 「再読み込みで全件また押せる」
のどちらかになり、 feature §5.3 の二重作成防止を満たせない)。 列追加は不要 (jsonb の中身)。

## cc_links — Concordia 接続記録

| 列 | 型 | NULL | 意味 |
|---|---|---|---|
| id | text (ULID) | no | PK |
| project_id | text | no | FK |
| target_kind | text | no | CHECK `spec|layout|transition` |
| target_id | text | no | |
| cc_kind | text | no | CHECK `delegation_run|taskflow_task` |
| cc_id | text | no | Cc 側 id |
| status | text | no | CHECK `queued|running|done|failed` |
| last_synced_at | timestamptz | yes | |
| created_at / updated_at | timestamptz | no | |

UNIQUE (`project_id`, `cc_kind`, `cc_id`)。

## 既存テーブルへの追加

| テーブル | 列 | 意味 |
|---|---|---|
| domains | `anatomia_domain text NULL` | Anatomia (正本) のドメイン名への射影 |
| projects | `anatomia_repo text NULL` | Anatomia project id (`^[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*)?$`) |
| spec_targets | CHECK `kind` に `'transition'` 追加 | |
| code_graph_* | CHECK `target_kind` に `'transition'` 追加 | |
| layouts | `kind` に `'screen'` を使う (列追加なし) | 2D 画面 |

## SQLite (ローカルモード)

上記 4 テーブル + `layout_objects` (001 と同形) を `sqlite-schema.ts` に追加する。 FK は張らない。
