# layout — シーン配置 + カメラ

1 layout = 1 シーン (= 「メイン画面」 「ボス部屋」 「タイトル画面」 等)。
同じ object を複数 layout で異なる transform で配置できる。

## `layouts`

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `name` | `text` | ✓ | — | 表示名 (`"メインシーン"`) |
| `description` | `text` |  | NULL | 概要 |
| `kind` | `text` | ✓ | `'world-3d'` | `world-3d` / `world-2d` / `ui-2d` |
| `is_default` | `boolean` | ✓ | `false` | project の default layout フラグ |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |
| `deleted_at` | `timestamptz` |  | NULL | — |

### Constraint
- 1 project につき `is_default = true` は最大 1 行 (= partial unique index)

### Index
- `idx_layouts_project` (`project_id`)

## `layout_objects`

ある layout 内に object を配置した行 (= placement)。 transform を持つ。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `layout_id` | `text` | ✓ | — | FK `layouts.id` |
| `object_id` | `text` | ✓ | — | FK `objects.id` |
| `position` | `jsonb` | ✓ | `'[0,0,0]'` | `[x,y,z]` (2D は z=0) |
| `rotation` | `jsonb` | ✓ | `'[0,0,0]'` | `[x,y,z]` (euler deg) or `[x,y,z,w]` (quat) |
| `scale` | `jsonb` | ✓ | `'[1,1,1]'` | `[x,y,z]` |
| `parent_layout_object_id` | `text` |  | NULL | placement 階層 (= layout 内の親子) |
| `lock_transform` | `boolean` | ✓ | `false` | デザイナーの transform 編集 lock (planner 用) |
| `ordinal` | `integer` | ✓ | `0` | 描画順 / list 順 |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |

### Constraint
- UNIQUE (`layout_id`, `object_id`) — 1 object は 1 layout 内に 1 placement
  (例外的に複数置きたい場合は object 自体を複製する規約)

### Index
- `idx_layout_objects_layout` (`layout_id`)
- `idx_layout_objects_object` (`object_id`)
- `idx_layout_objects_parent` (`parent_layout_object_id`)

## `cameras`

3D layout のカメラ設定。 1 layout に複数カメラを持ち、 active を 1 つ選ぶ。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `layout_id` | `text` | ✓ | — | FK `layouts.id` |
| `name` | `text` | ✓ | `'main'` | 表示名 (`main` / `debug` / `cinematic` 等) |
| `kind` | `text` | ✓ | `'perspective'` | `perspective` / `orthographic` |
| `position` | `jsonb` | ✓ | `'[0,5,-10]'` | `[x,y,z]` |
| `target` | `jsonb` | ✓ | `'[0,0,0]'` | 注視点 `[x,y,z]` |
| `up` | `jsonb` | ✓ | `'[0,1,0]'` | 上方向 |
| `fov` | `real` |  | 60.0 | 度 (perspective 時) |
| `ortho_size` | `real` |  | 10.0 | ortho 時の高さ |
| `near` | `real` | ✓ | 0.1 | near plane |
| `far` | `real` | ✓ | 1000.0 | far plane |
| `is_default` | `boolean` | ✓ | `false` | layout 内の default 表示カメラ |

### Constraint
- UNIQUE (`layout_id`, `name`)
- 1 layout に default camera は最大 1 (partial unique)

### Index
- `idx_cameras_layout` (`layout_id`)
