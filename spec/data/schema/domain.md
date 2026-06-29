# domain — ドメイン定義

オブジェクトの 「役割 / カテゴリ」 を定義する。 `Player` / `Enemy` /
`Terrain` / `UI` 等。 機能要件 §F2 を参照。

## `domains`

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `name` | `text` | ✓ | — | 表示名 (`"Player"`、 project 内 unique) |
| `description` | `text` |  | NULL | 概要 |
| `color` | `text` | ✓ | `'#888888'` | placeholder のデフォルト色 (`#RRGGBB`) |
| `icon` | `text` |  | NULL | 一覧 UI 用 (emoji or icon name) |
| `parent_id` | `text` |  | NULL | FK `domains.id` (継承元) |
| `max_count` | `integer` |  | NULL | 同 project 内の最大 instance 数 (NULL = 制限なし) |
| `required_attrs` | `jsonb` | ✓ | `'[]'` | 必須 attribute 名 + 型 (`[{"name":"hp","type":"number"}]`) |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |

### Constraint
- UNIQUE (`project_id`, `name`)
- `required_attrs` は JSON Schema 風の structure (= `{name, type, default?, enum?}`)

### Index
- `idx_domains_project` (`project_id`)
- `idx_domains_parent` (`parent_id`)

### 継承

`parent_id` で別 domain を継承可能 (例: `EliteEnemy extends Enemy`)。
`required_attrs` は親 + 子をマージ (子で上書き可)。 オブジェクトの validation
は backend が継承解決した結果に対して行う。

## 既定 domain セット

新規 project 作成時に以下を seed する (= `migrations/002_seed_domains.sql`):

| name | color | 用途 |
|---|---|---|
| `Player` | `#3366ff` | 操作対象キャラクタ |
| `Enemy` | `#cc3333` | 敵キャラクタ |
| `Terrain` | `#888844` | 地面 / 壁 / 障害物 |
| `UI` | `#66cc66` | HUD / メニュー (画面座標) |
| `Camera` | `#cccccc` | 描画視点 |
| `Light` | `#ffff66` | 光源 (3D) |
| `Trigger` | `#cc66cc` | 接触イベント発火域 |
| `Spawner` | `#66cccc` | 動的生成元 |

seed 済 domain は project owner が rename / 削除可能 (= テンプレート)。
