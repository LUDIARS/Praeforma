# project — プロジェクト + メンバー

Praeforma の最上位単位。 1 プロジェクト = 1 作品 (= 1 ゲーム / 1 業務システム
等)。 Cernere organization に紐付け、 メンバー role を管理する。

## `projects`

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `name` | `text` | ✓ | — | 表示名 (`"クズサバ プロト"` 等) |
| `description` | `text` |  | NULL | 概要 |
| `org_id` | `text` | ✓ | — | Cernere organization UUID |
| `owner_user_id` | `text` | ✓ | — | Cernere user UUID (owner) |
| `platforms` | `jsonb` | ✓ | `'["web"]'` | 出力対象 (`["web","unity"]` 等) |
| `default_layout_id` | `text` |  | NULL | デフォルトで開く layout |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |
| `deleted_at` | `timestamptz` |  | NULL | ソフトデリート |

### Index
- `idx_projects_org` (`org_id`)
- `idx_projects_owner` (`owner_user_id`)

## `project_members`

ユーザの role 付与。 owner / planner / designer / programmer / reviewer / viewer。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `user_id` | `text` | ✓ | — | Cernere user UUID |
| `role` | `text` | ✓ | `'viewer'` | `owner` / `planner` / `designer` / `programmer` / `reviewer` / `viewer` |
| `display_name` | `text` |  | NULL | Cernere display name の snapshot (= 表示用 cache) |
| `joined_at` | `timestamptz` | ✓ | `now()` | — |
| `last_seen_at` | `timestamptz` |  | NULL | 最終アクセス (= プレゼンス用) |

### Constraint
- UNIQUE (`project_id`, `user_id`) — 1 user は 1 project に 1 role
- CHECK `role IN ('owner','planner','designer','programmer','reviewer','viewer')`

### Index
- `idx_project_members_project` (`project_id`)
- `idx_project_members_user` (`user_id`)

## 個人データ方針

Cernere が単一情報源。 Praeforma DB には Cernere user UUID + display_name
snapshot のみ持つ。 email / 認証 token は持たない。 display_name は表示用
cache で stale OK (= 必要なら表示時に Cernere に resolve)。
