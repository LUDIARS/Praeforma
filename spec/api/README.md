# `spec/api/` — HTTP / WebSocket 契約

Praeforma backend (`server/`) が公開する API の仕様。
schema (= `spec/schema/`) を元に組まれており、 Step 2 で core 5 + Step 1.5 の
references/feedback + Step 7 acceptance + Step 10 assets + Step 13 reference
content が実装済。

## ステータス

**S1 完了 (実装ベース)** — 全 REST + WS が `server/src/routes/`,
`server/src/ws/` に存在する。 詳細は各 route ファイルを参照、 ここではマップのみ。

## REST (Hono routes)

| 領域 | path | 主操作 |
|---|---|---|
| **認証** | `/api/auth/me` | identity 取得 (PASETO V4 検証後) |
| **projects** | `/api/projects` | list / create |
| | `/api/projects/:pid` | get / patch / delete |
| | `/api/projects/:pid/members[...]` | CRUD (owner only) |
| **domains** | `/api/projects/:pid/domains` | CRUD + 継承解決 (`resolveInheritedAttrs`) |
| **objects** | `/api/projects/:pid/objects` | CRUD + soft delete |
| | `/api/projects/:pid/objects/:oid/attrs` | bulk replace |
| **layouts** | `/api/projects/:pid/layouts` | CRUD |
| | `/api/projects/:pid/layouts/:lid/objects` | bulk replace (diff INSERT/UPDATE/DELETE) |
| | `/api/projects/:pid/layouts/:lid/cameras[...]` | CRUD |
| **specs** | `/api/projects/:pid/specs` | CRUD + **楽観ロック** (`prev_version` で CAS) |
| | `/api/projects/:pid/specs/:sid/targets` | bulk replace |
| | `/api/projects/:pid/specs/:sid/acceptance` | bulk replace (level + expression) |
| **references** | `/api/projects/:pid/references` | list / create / delete |
| | `/api/projects/:pid/references/:rid/content` | Notion/GoogleDocs/Confluence の markdown 取得 |
| **feedback** | `/api/projects/:pid/feedback` | list / get / create / patch (state 含む) |
| | `/api/projects/:pid/feedback/:fid/comments` | comment 追加 |
| **acceptance** | `/api/projects/:pid/acceptance/runs[...]` | runs start / finish / get / list |
| | `/api/projects/:pid/acceptance/runs/:rid/results` | result bulk upsert |
| | `/api/projects/:pid/acceptance/runs/:rid/events` | event ingest (Step 12) |
| | `/api/projects/:pid/acceptance/runs/:rid/evaluate-events` | event-level pattern 評価 |
| **assets** | `/api/projects/:pid/assets[...]` | CRUD + soft delete |
| | `/api/projects/:pid/assets/:aid/presign` | pre-signed URL (Stub) |
| | `/api/projects/:pid/assets/links` | object_assets 紐付け |
| **health** | `/api/health` | DB 接続状態確認 (auth 不要) |

## WebSocket

| path | 用途 |
|---|---|
| `/ws/edit?project=<id>` | edit_ops broadcast + presence cursor + 30s ping |

### WS プロトコル

```
client → server: { "type": "auth", "token": "<PASETO>" }      # 接続直後 1 回
server → client: { "type": "hello", "session_id": "..." }

client → server: { "type": "cursor", "payload": { ... } }
server → all  :  { "type": "presence", "users": [...] }

client → server: { "type": "op", "op": "...", "target_kind": "...",
                   "target_id": "...", "payload": {...}, "prev_version"? }
server → others: { "type": "op", id, op, target_kind, target_id, payload, user_id, created_at }

server → client: { "type": "ping", "ts": N }
client → server: { "type": "pong", "ts": N }
```

5 分間 pong が来ない session は server が auto-disconnect (cron 未実装、 v0.2)。

## 認証

- REST / WS とも `Authorization: Bearer <PASETO V4 token>` (Cernere 発行)
- 検証: `server/src/auth/paseto.ts` (公開鍵 6h 毎 refresh)
- ロール検査: `server/src/middleware/require-role.ts` (= project_members を引く)

## エラー

LUDIARS 標準形式:

```json
{ "error": "version_conflict", "detail": { "server_version": 3, "provided_version": 2 } }
```

HTTP status は `AppError` (400 / 401 / 403 / 404 / 409 / 500) を使う。

## Pagination

全 list endpoint で `?limit=&offset=`。 既定 50 / max 200。
レスポンス: `{ items: [...], limit: N, offset: M }` (+ 一部 total)。

## 楽観ロック

- `specs` のみ `version` を持つ
- PATCH `/api/projects/:pid/specs/:sid` は `prev_version` 必須
- 不一致は `409 Conflict` + `{ server_version, provided_version }`
- 他テーブル (objects/layouts/...) は LWW 既定 (= 競合検出なし)

## audit_log 蓄積

`server/src/lib/audit.ts` の `recordAudit({ projectId, actor, action, ... })` で記録。
すべての破壊的操作 (`project.*` `member.*` `domain.*` `object.*` `layout.*`
`spec.*` `asset.*` `acceptance.run_*` 等) で呼ばれる。
