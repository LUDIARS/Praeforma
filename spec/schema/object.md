# object — オブジェクト + 属性

placeholder として配置される実体。 1 つ以上の domain に属し、 attrs を持つ。

## `objects`

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `domain_id` | `text` | ✓ | — | FK `domains.id` (主 domain) |
| `label` | `text` | ✓ | — | 画面表示名 (`"プレイヤー (主人公)"` 等) |
| `placeholder_shape` | `text` | ✓ | `'cube'` | `cube` / `sphere` / `plane` / `cylinder` / `sprite` / `image` |
| `placeholder_color` | `text` | ✓ | `'#888888'` | `#RRGGBB` (= domain.color override) |
| `placeholder_image_asset_id` | `text` |  | NULL | FK `assets.id` (= 仮画像) |
| `parent_object_id` | `text` |  | NULL | FK `objects.id` (親子関係) |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |
| `deleted_at` | `timestamptz` |  | NULL | ソフトデリート |

### Note
- transform は `layout_objects` 側に持つ (= 同じ object を複数 layout で
  別位置に置けるため)。 「default transform」 が要るなら `layouts/_default` を
  使う規約
- 副次 domain (= 1 object が複数 domain に属する) は `object_domains`
  テーブルで N:M (v2 で導入)

### Index
- `idx_objects_project` (`project_id`)
- `idx_objects_domain` (`domain_id`)
- `idx_objects_parent` (`parent_object_id`)

## `object_attrs`

オブジェクト固有の属性値 (= domain.required_attrs を満たす + 追加属性)。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `bigserial` | ✓ | — | PK |
| `object_id` | `text` | ✓ | — | FK `objects.id` |
| `key` | `text` | ✓ | — | attribute 名 (`hp` / `speed` 等) |
| `value` | `jsonb` | ✓ | — | 値 (型は domain.required_attrs に従う) |
| `inherited_from` | `text` |  | NULL | 上位 object/domain から継承時の参照元 |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |

### Constraint
- UNIQUE (`object_id`, `key`)

### Index
- `idx_object_attrs_object` (`object_id`)
- `idx_object_attrs_key` (`key`) — query 高速化 (= 「全 player の hp 一覧」 等)
