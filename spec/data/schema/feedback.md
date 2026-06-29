# feedback — シーン上のオブジェクトに対する FB / 仕様コメント

Ars-Musa の Melpomene を参考にした、 **シーン上のオブジェクトに紐づく
フィードバック / 仕様コメント** のデータモデル。 Web / Unity 双方から
作成・閲覧でき、 layout を開いた時に位置 (3D world / 2D screen) を
ピンとして表示する。

## Melpomene との対応

Ars-Musa Melpomene の `Ticket` (`scene_name`, `object_path`, `world_position`,
`screen_position`, `priority`, `category`, `state`, `comments[]`) と同型。
違いは:

- 永続化先: GitHub Issues → **Praeforma 自身の Postgres** (project 内完結)
- target 解像: Unity scene path → **Praeforma の layout_object_id**
  (Unity の scene path は object_path フィールドに併記して両側対応)
- 認証: GitHub OAuth → **Cernere PASETO V4**

## 動機

- Unity Editor で「ここの enemy の挙動おかしくない?」 をその場でピン留めしたい
- Web の 2D 配置 editor でも同じ FB を見える化したい
- 仕様 (= specs) よりカジュアルな単位の意見・確認事項を貯める
- 「これ仕様か? バグか?」 を後で issue 化するための前段

## `object_feedback`

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `layout_id` | `text` |  | NULL | FK `layouts.id` (= どの scene で発火、 NULL なら project 全体) |
| `object_id` | `text` |  | NULL | FK `objects.id` (= 対象 object、 NULL なら scene 自体への FB) |
| `layout_object_id` | `text` |  | NULL | FK `layout_objects.id` (= 特定 placement、 = scene + object の交点) |
| `scene_path` | `text` |  | NULL | Unity scene path (= `"Root/Player/Mesh"` 等、 Melpomene 互換) |
| `world_position` | `jsonb` |  | NULL | `[x,y,z]` (3D world) |
| `screen_position` | `jsonb` |  | NULL | `[x,y]` (UI 平面 or 2D editor 上) |
| `title` | `text` | ✓ | — | 短いタイトル (1 行) |
| `body` | `text` |  | NULL | Markdown 本文 |
| `priority` | `text` | ✓ | `'medium'` | `low` / `medium` / `high` / `critical` |
| `category` | `text` | ✓ | `'question'` | `bug` / `feature` / `improvement` / `question` / `spec-clarification` |
| `state` | `text` | ✓ | `'open'` | `open` / `in-progress` / `resolved` / `wont-fix` |
| `labels` | `jsonb` | ✓ | `'[]'` | 文字列配列 (自由 tag) |
| `assignee_user_id` | `text` |  | NULL | Cernere user UUID |
| `github_issue_number` | `integer` |  | NULL | GH Issue 連携時の番号 (= Melpomene 互換、 v0.2+) |
| `created_by` | `text` | ✓ | — | Cernere user UUID |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |
| `resolved_at` | `timestamptz` |  | NULL | state が resolved/wont-fix に遷移した時刻 |

### Constraint

- CHECK `priority IN ('low','medium','high','critical')`
- CHECK `category IN ('bug','feature','improvement','question','spec-clarification')`
- CHECK `state IN ('open','in-progress','resolved','wont-fix')`

### Index

- `idx_object_feedback_project` (`project_id`, `state`)
- `idx_object_feedback_layout` (`layout_id`, `state`)
- `idx_object_feedback_object` (`object_id`)
- `idx_object_feedback_layout_object` (`layout_object_id`)

## `feedback_comments`

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `feedback_id` | `text` | ✓ | — | FK `object_feedback.id` |
| `user_id` | `text` | ✓ | — | Cernere user UUID |
| `display_name` | `text` |  | NULL | snapshot |
| `body` | `text` | ✓ | — | Markdown |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |

### Index

- `idx_feedback_comments_feedback` (`feedback_id`, `created_at`)

## 位置情報の使い分け

| 入力 | 表示 | 用途 |
|---|---|---|
| `layout_object_id` のみ | 該当 placement の transform に追従 | 「この object の placement に対する FB」 (推奨) |
| `world_position` のみ | scene 内の絶対座標にピン | scene 自体への FB (= object 特定不能 / 空中) |
| `screen_position` のみ | 2D overlay 座標 (UI 平面 etc) | UI レイアウトへの FB |
| 複数 | object に追従しつつ overlay も補助表示 | Unity Editor で gizmo 重ね表示 |

少なくとも 1 つは指定推奨。 全 NULL は「project 全体への FB」 として許容。

## UI 想定 (Web)

- layout editor の右上に `📍 FB` トグル → ピン表示 ON
- placeholder クリック → 右ペインに該当 object の FB リスト
- 「+ FB を追加」 で title + body + priority + category を入力
- 状態は色分けピン (open=黄 / in-progress=青 / resolved=緑 / wont-fix=灰)

## UI 想定 (Unity Editor)

- Praeforma window の「Feedback」 タブ
- Scene view 上で gizmo (= Melpomene 互換):
  - 球体 + 縦軸の旗 で world_position に立つ
  - クリックで Inspector に FB details を出す
- Hierarchy 選択中の GameObject に対応する layout_object に対する FB を
  Inspector 下部に list 表示
- 「+ Add Feedback」 ボタンで Scene カメラ位置 (= ピン置きたい座標) に
  新規ピン生成 → fields 入力

## 権限

| 操作 | 必要 role |
|---|---|
| 一覧 / 個別閲覧 | `viewer` 以上 |
| 作成 | `reviewer` 以上 (= viewer 以外全員) |
| 自分の FB の編集 / 削除 | 投稿者 + `owner` / `planner` |
| 他人の FB の state 変更 | `owner` / `planner` / `programmer` (= 「対応する人」) |
| `wont-fix` / `resolved` に閉じる | `owner` / `planner` |

## 関連

- Ars-Musa Melpomene (= 参考実装、 GitHub Issues backed)
- Praeforma spec/api/README.md (= REST endpoint 整理)
- §12 collaboration (= edit_ops broadcast と独立。 feedback は監査 log は
  audit_log には積まない、 feedback_comments で十分)
