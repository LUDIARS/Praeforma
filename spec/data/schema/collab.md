# collab — コラボレーション (edit session / op log / 監査)

[§12 Cernere 連携前提の collaboration](../praeforma.md#12-collaboration-cernere-連携前提)
を支えるテーブル群。 リアルタイム同期 + 監査ログ。

## `edit_sessions`

WebSocket 接続 1 本 = 1 session。 プレゼンス + cursor 共有に使う。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `text` (ULID) | ✓ | ULID | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `user_id` | `text` | ✓ | — | Cernere user UUID |
| `client_kind` | `text` | ✓ | — | `web` / `unity` |
| `cursor` | `jsonb` |  | NULL | `{layout_id, position, selected_object_id}` |
| `connected_at` | `timestamptz` | ✓ | `now()` | — |
| `last_heartbeat_at` | `timestamptz` | ✓ | `now()` | 30s ごとに更新 |
| `disconnected_at` | `timestamptz` |  | NULL | NULL = active |

### Constraint
- CHECK `client_kind IN ('web','unity')`

### Index
- `idx_edit_sessions_project_active` (`project_id`) WHERE `disconnected_at IS NULL`
- `idx_edit_sessions_user` (`user_id`)

### 運用
- backend は 5 分間 heartbeat が無い session を auto-disconnect する cron を持つ
- 全 active session の cursor は WebSocket で全 peer に broadcast (= プレゼンス)

## `edit_ops`

各 edit 操作 (= object move / spec update / asset link 等) の operation log。
リアルタイム同期 + version 管理に使う。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `bigserial` | ✓ | — | PK (= グローバル順序、 monotonic) |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `session_id` | `text` |  | NULL | FK `edit_sessions.id` (= どの session から発火) |
| `user_id` | `text` | ✓ | — | Cernere user UUID |
| `op` | `text` | ✓ | — | `create` / `update` / `delete` / `move` / `link-asset` 等 |
| `target_kind` | `text` | ✓ | — | `object` / `layout_object` / `spec` / `domain` / `asset` / `project_member` |
| `target_id` | `text` | ✓ | — | 対象行の id |
| `payload` | `jsonb` | ✓ | `'{}'` | 変更内容 (= JSON Patch 風 or 全 row 値) |
| `prev_version` | `integer` |  | NULL | 楽観ロック (= specs.version 等が対象なら必須) |
| `created_at` | `timestamptz` | ✓ | `now()` | — |

### Index
- `idx_edit_ops_project_id_desc` (`project_id`, `id` DESC) — broadcast の追従用
- `idx_edit_ops_target` (`target_kind`, `target_id`) — 「この object の編集履歴」

### 競合解決
- field-level Last-Writer-Wins (= 既定): conflict 検出は行わず後勝ち
- 楽観ロック対象 (= spec.version 持つ系列): `prev_version` 一致を CAS。 不一致は
  `409 Conflict` を返し、 frontend の conflict resolver に上げる

### 保持
- 直近 30 日は全件保持。 それ以前は target_id / op 種別ごとに最後の 10 件のみ残し、
  残りは 月次 rollup。 retention は cron が回す

## `audit_log`

権限変更 / プロジェクト設定変更 等 「人事系」 操作の監査ログ。
edit_ops とは別経路 (= edit_ops は細粒度 / audit_log は粗粒度かつ
永続)。

| 列 | 型 | NotNull | Default | 役割 |
|---|---|---|---|---|
| `id` | `bigserial` | ✓ | — | PK |
| `project_id` | `text` | ✓ | — | FK `projects.id` |
| `actor_user_id` | `text` | ✓ | — | Cernere user UUID |
| `actor_display_name` | `text` |  | NULL | snapshot |
| `action` | `text` | ✓ | — | `project.create` / `member.add` / `member.role_change` / `member.remove` / `project.delete` / `acceptance.run` 等 |
| `target_kind` | `text` |  | NULL | (任意) `user` / `project` 等 |
| `target_id` | `text` |  | NULL | — |
| `meta` | `jsonb` | ✓ | `'{}'` | 変更前後値 (= role 変更なら `{from:'planner', to:'designer'}`) |
| `ip` | `text` |  | NULL | IPv4/IPv6 (= 監査用) |
| `user_agent` | `text` |  | NULL | — |
| `created_at` | `timestamptz` | ✓ | `now()` | — |

### Index
- `idx_audit_log_project` (`project_id`, `created_at` DESC)
- `idx_audit_log_actor` (`actor_user_id`, `created_at` DESC)
- `idx_audit_log_action` (`project_id`, `action`)

### 保持
- 永続 (= 削除しない)。 監査用件で「いつ誰が削除した」 を後追いするため。
  ストレージ的に問題が出たら年次パーティショニング

## role × action 権限マトリクス (抜粋)

| action / role | owner | planner | designer | programmer | reviewer | viewer |
|---|---|---|---|---|---|---|
| project.delete | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| member.add/remove/role_change | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| object.create/delete | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| domain.create/delete | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| spec.create/edit | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| layout_object.transform 編集 | ✓ | ✓ | ✓ (lock 無し時のみ) | ✗ | ✗ | ✗ |
| asset.upload + object_assets.link | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| acceptance.run | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| spec.review (comment) | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| 全体閲覧 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

詳細マトリクスは `server/src/auth/permissions.ts` に集中させる (= row レベルで
権限判定する場所を 1 箇所に絞る)。
