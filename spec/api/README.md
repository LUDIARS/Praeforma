# `spec/api/` — HTTP / WebSocket 契約

Praeforma backend (`server/`) が公開する API の仕様書。 schema (= spec/schema/)
を元に REST + WS 契約を起こす。 ファイルは未起稿。

## ステータス

**未起稿** (= backlog S1)。 schema 定義は spec/schema/ に揃ったので、 着手は
schema を読みながら CRUD 中心に積み上げる。

## 起こすべきセクション (draft)

### REST (Hono routes)

| 領域 | path | 主操作 |
|---|---|---|
| auth | `/api/auth/login-url`, `/api/auth/exchange`, `/api/auth/me` | Cernere composite (Memoria Hub と同型) |
| projects | `/api/projects[/:id]` | CRUD + member 管理 |
| domains | `/api/projects/:pid/domains[/:id]` | CRUD + 継承解決 |
| objects | `/api/projects/:pid/objects[/:id]` | CRUD + attrs |
| layouts | `/api/projects/:pid/layouts[/:id]` | CRUD + layout_objects + cameras |
| specs | `/api/projects/:pid/specs[/:id]` | CRUD + targets + acceptance |
| assets | `/api/projects/:pid/assets[/:id]` | upload (pre-signed URL) + link |
| acceptance | `/api/projects/:pid/acceptance/runs[/:id]` | 実行 trigger + result 取得 |
| audit | `/api/projects/:pid/audit` | log 閲覧 (owner / planner のみ) |

### WebSocket

| path | 用途 |
|---|---|
| `/ws/edit?project=<id>` | リアルタイム同期 (= edit_ops broadcast + presence) |
| `/ws/runtime?run=<id>` | acceptance runner との probe 通信 (= probe RPC + event 流) |

### 認証

- REST / WS とも `Authorization: Bearer <service_token>` (Cernere composite で得た)
- 検証は `@ludiars/cernere-id-cache` で local (= Cernere に毎回問い合わせない)

### エラー

- LUDIARS 標準形式: `{ error: string, detail?: any }` + HTTP status
- 楽観ロック競合: `409 Conflict`、 body に最新 server version を含める

### Pagination

- 全 list endpoint で `?limit=<N>&offset=<M>` (= デフォルト 50, max 200)
- response: `{ items: [...], total: number, limit, offset }`

## 着手手順

1. `auth` 系 (Cernere composite 連携) を最初に
2. `projects` + `project_members` の CRUD
3. `domains` + `objects` + `layouts` の CRUD (= 配置 editor が動く最小単位)
4. `specs` + `acceptance` (= 仕様編集 + 評価)
5. `assets` (= S3/MinIO 連携)
6. WebSocket (= collaboration)
