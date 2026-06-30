# 設計レビュー — Praeforma v0.1 (2026-05-17)

## 1. 設計強度: B

| 評価 | 観点 | 所見 |
|------|------|------|
| B | 障害分離 | DB down 時に health 200、collab.ts:142-144 で warn log のみ。audit_log 失敗 silent (OK) |
| B | 冪等性 | migration 冪等 (IF NOT EXISTS)、endpoint は idempotent key なし。WS op の再送重複排除なし |
| A | 入力バリデーション | Zod schema 全 route (projects/acceptance 等)。domain 継承 required_attrs は stub、reference.url SSRF 対策不十分 |
| A | エラーハンドリング | AppError 統一 400/401/403/404/409/500、全 route で catch、WS は safeSend |
| B | リトライ・タイムアウト | Hono timeout なし (Node default ~2min)、WS ping 30s、client pong timeout 10s だが server-side timeout 未実装 |
| A | 状態管理 | project → domain → object → layout 階層明確、楽観ロック (specs.version) で競合検出 |

### チェック項目

- [x] SPOF: DB が SPOF だが、health 返却で external monitoring 可能
- [x] 外部サービス障害: Cernere public key fetch 6h cache 必要 (startPaseto + 定期 refresh 未実装) ← critical
- [x] 入力値境界値: Zod min/max、required_attrs 検証 stub
- [x] fail-safe: 500 + AppError.internal
- [x] 非同期タイムアウト: WS ping/pong OK、HTTP timeout なし
- [x] race condition: 楽観ロック OK、WS op の順序は DB bigserial で保証

## 2. 設計思想一貫性: A

| 該当箇所 | 逸脱 | 推奨修正 |
|----------|------|---------|
| server/src/routes/specs.ts:150-200 (bulk PATCH) | spec accept 配列が DELETE + INSERT、原子性弱い | ON CONFLICT DO UPDATE で構成 |
| server/src/routes/reference-content.ts:全体 | Notion/GoogleDocs proxy が認可トークン扱い不定 | token whitelist + rate limit middleware |
| web/src/lib/api.ts:32-50 | req() error 時 JSON.parse で fail-open | 500 で fail-fast |
| Packages/jp.ludiars.praeforma/Editor/PraeformaWindow.cs | PASETO token 検証なし、stored token 有効期限チェック未実装 | AuthStorage.cs で token.exp + refresh |

## 3. モジュール分割度・凝集度: A

| モジュール | 凝集度 | 所見 |
|-------------------|-----------|------|
| server/src/routes/*.ts | 機能的 | 1 リソース (project/domain/object 等) に一貫 |
| server/src/db/schema/*.ts | 機能的 | 1 table + related index |
| server/src/middleware/*.ts | 機能的 | require-auth / require-role 分離 |
| server/src/lib/*.ts | 機能的 | audit/errors/pagination/event-buffer 独立 |
| web/src/pages/*.tsx | 通信的 | ProjectListPage / LayoutEditorPage |
| web/src/components/PlacementCanvas.tsx | 逐次的 | useLayoutOps state management 弱、v0.2 で Zustand/Redux |
| Packages/.../PraeformaWindow.cs | 手続き的 | 4 view tab が 1 window に詰込、View class 分離余地 |

**SRP/God Object/循環依存: なし** ✓

## 総合評価

| # | 観点 | 評価 |
|---|------|------|
| 1 | 設計強度 | B (2: Cernere key refresh / WS timeout) |
| 2 | 設計思想一貫性 | A |
| 3 | モジュール分割度 | A |

**評価: B** — 堅牢だが、外部依存の障害復旧戦略と非同期タイムアウト設定が incomplete。
