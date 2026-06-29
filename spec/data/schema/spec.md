# spec — 仕様 (要件定義) + acceptance

機能要件 §F3 で定義した仕様テキストを格納。 object / domain / project に
紐付けられる。

## `specs`

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `code` | `text` | ✓ | — | `SPEC-001-PLAYER-MOVE` 等の人間 ID (project 内 unique) |
| `title` | `text` | ✓ | — | 短いタイトル (1 行) |
| `description` | `text` |  | NULL | Markdown 自由記述 |
| `priority` | `text` | ✓ | `'should'` | MoSCoW: `must` / `should` / `could` / `wont` |
| `category` | `text` | ✓ | `'behavior'` | `behavior` / `appearance` / `data` / `interaction` |
| `preconditions` | `jsonb` | ✓ | `'[]'` | 前提条件の文字列配列 |
| `postconditions` | `jsonb` | ✓ | `'[]'` | 事後条件の文字列配列 |
| `status` | `text` | ✓ | `'draft'` | `draft` / `review` / `approved` / `obsolete` |
| `version` | `integer` | ✓ | 1 | 楽観ロック用 |
| `created_by` | `text` | ✓ | — | Cernere user UUID |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |
| `deleted_at` | `timestamptz` |  | NULL | — |

### Constraint
- UNIQUE (`project_id`, `code`)
- CHECK `priority IN ('must','should','could','wont')`
- CHECK `category IN ('behavior','appearance','data','interaction')`
- CHECK `status IN ('draft','review','approved','obsolete')`

### Index
- `idx_specs_project` (`project_id`)
- `idx_specs_status` (`project_id`, `status`)

## `spec_targets`

spec が対象とする実体 (object / domain / project)。 1 spec は複数 target を
持てる。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `bigserial` | ✓ | — | PK |
| `spec_id` | `text` | ✓ | — | FK `specs.id` |
| `kind` | `text` | ✓ | — | `object` / `domain` / `project` / `layout`(=scene) |
| `ref_id` | `text` | ✓ | — | 対象の `objects.id` / `domains.id` / `projects.id` / `layouts.id` |

### Constraint
- UNIQUE (`spec_id`, `kind`, `ref_id`)
- CHECK `kind IN ('object','domain','project','layout')` (`layout` は要件定義モードで追加、 migration 003)
- 外部キー: kind ごとに対応テーブルへ。 polymorphic FK は app 側で検証

### Index
- `idx_spec_targets_spec` (`spec_id`)
- `idx_spec_targets_ref` (`kind`, `ref_id`) — 「この object に紐付く spec 一覧」 を引く

## `spec_acceptance`

1 spec に紐付く acceptance 条件 1 行ずつ。 [§11 acceptance test 詳細](../praeforma.md#11-acceptance-test-の詳細)
の `manual` / `assertion` / `event` を持つ。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `spec_id` | `text` | ✓ | — | FK `specs.id` |
| `ordinal` | `integer` | ✓ | `0` | 表示順 |
| `text` | `text` | ✓ | — | 人が読む条件文 (= レビュー / 手動 QA 用) |
| `level` | `text` | ✓ | `'manual'` | `manual` / `assertion` / `event` |
| `expression` | `text` |  | NULL | JS 式 / event DSL (level != manual のとき必須) |
| `kind` | `text` | ✓ | `'positive'` | `positive` (満たすべき) / `negative` (起きてはならない) |
| `enabled` | `boolean` | ✓ | `true` | 一時的に skip するときに `false` |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |

### Constraint
- CHECK `level IN ('manual','assertion','event')`
- CHECK `kind IN ('positive','negative')`
- CHECK `(level = 'manual' OR expression IS NOT NULL)`

### Index
- `idx_spec_acceptance_spec` (`spec_id`)

## spec.code (= 人間 ID) 規約

`SPEC-<NNN>-<DOMAIN>-<VERB>`:
- `NNN` 3 桁ゼロ埋め (`001` 〜 `999`)、 1000 を超えたら 4 桁に拡張
- `DOMAIN` は対象 domain の大文字 (= `PLAYER` / `ENEMY` / `UI`)
- `VERB` は動詞 + 補語 (= `MOVE` / `HP-DAMAGE` / `MENU-OPEN`)
- 例: `SPEC-001-PLAYER-MOVE` / `SPEC-042-ENEMY-AI-CHASE` / `SPEC-100-UI-OPEN`
