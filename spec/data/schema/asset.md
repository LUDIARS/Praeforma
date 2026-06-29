# asset — アセット + object 紐付け

デザイナーが差し替える画像 / 3D モデル等。 実体は object storage
(MinIO / S3) に置き、 DB はメタ + 参照のみ。

## `assets`

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `name` | `text` | ✓ | — | 表示名 (`"player.glb"` 等) |
| `kind` | `text` | ✓ | — | `image` / `sprite` / `model-3d` / `unity-prefab` / `particle` / `other` |
| `mime_type` | `text` |  | NULL | `image/png` 等 |
| `storage_url` | `text` | ✓ | — | `s3://bucket/path` or `https://...` |
| `size_bytes` | `bigint` |  | NULL | — |
| `checksum_sha256` | `text` |  | NULL | 整合性検証用 |
| `meta` | `jsonb` | ✓ | `'{}'` | 種類別 meta (= 3D は vertex 数 / image は解像度 等) |
| `uploaded_by` | `text` | ✓ | — | Cernere user UUID |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |
| `deleted_at` | `timestamptz` |  | NULL | — |

### Constraint
- CHECK `kind IN ('image','sprite','model-3d','unity-prefab','particle','other')`

### Index
- `idx_assets_project` (`project_id`)
- `idx_assets_kind` (`project_id`, `kind`)

## `object_assets`

object に対する platform 別アセット紐付け (= 1 object × N platform)。
機能要件 §F4 「1 オブジェクトに platform 別アセットを持てる」 を表現。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `bigserial` | ✓ | — | PK |
| `object_id` | `text` | ✓ | — | FK `objects.id` |
| `platform` | `text` | ✓ | — | `web` / `webgl` / `unity` / `2d-web` 等 |
| `asset_id` | `text` | ✓ | — | FK `assets.id` |
| `transform_override` | `jsonb` |  | NULL | placeholder からの差分 (任意 = 既定は placeholder transform を使う) |
| `created_at` | `timestamptz` | ✓ | `now()` | — |
| `updated_at` | `timestamptz` | ✓ | `now()` | — |

### Constraint
- UNIQUE (`object_id`, `platform`) — 1 object × 1 platform = 1 asset

### Index
- `idx_object_assets_object` (`object_id`)
- `idx_object_assets_asset` (`asset_id`)

## storage の運用

- ローカル dev: MinIO (= `infra-minio-1` を流用、 LUDIARS 共通インフラ)
- production: S3 互換 (= AWS S3 / Cloudflare R2 / 等)
- バケット命名: `praeforma-<env>-<project_id_prefix>`
- アップロード: backend が pre-signed URL を発行 → frontend / Unity が直 PUT
- 削除: ソフトデリート (= `deleted_at` 設定) → cron で stale を物理削除
