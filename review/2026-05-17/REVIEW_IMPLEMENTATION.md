# Web 実装評価 — Praeforma v0.1 (2026-05-17)

## 1. データスキーマ妥当性・重複確認

| テーブル / モデル | 評価 | 説明 |
|-----------------|------|------|
| projects | A | project + project_members で適切に分離、org_id FK なし (Cernere 単一情報源) |
| domains | A | domain 継承 (parent_id) 対応、required_attrs validation stub |
| objects | A | object + object_attrs で attribute 分離、parent_object_id で親子、placeholder_image_asset_id FK なし |
| layout_objects | A | 座標 bigint 分散、lock_transform で designer override |
| spec_acceptance | A | spec → acceptance (1:N) + targets 分離、expression DSL を文字列保存だが pattern validator 不足 |
| assets + object_assets | A | asset + object_assets 分離、 platform 別組合せ可能、 storage adapter v0.2 予定 |
| acceptance_runs + results | A | run + results 分離、event ringbuffer in-memory (run 終了 discard) |

### チェック項目
- [x] 同一概念モデル: なし (audit_log 統合)
- [x] フィールド型: id=text/uuid, ts=timestamptz, attrs=jsonb
- [x] 制約 (NOT NULL/UNIQUE/FK): CHECK on role enum、UNIQUE on uq_domains_project_name
- [x] インデックス最適化: project_id / user_id 主要 query
- [x] マイグレーション破壊変更なし: 001_init + 002_refs_feedback IF NOT EXISTS
- [x] API ↔ DB スキーマ一致: web/src/lib/api.ts DTO と routes 応答一致
- [x] Enum 一致: platform / role 全 6 値一致
- [x] N+1 リスク: 単一 query で JOIN

**小計: A** (domain required_attrs validation stub)

## 2. SRE 観点

| 評価 | 観点 | 所見 |
|------|------|------|
| B | 可観測性 | console.log/warn 基本ログ、構造化ログ (traceID/requestID) なし、WS op sequence debug 困難 |
| C | デプロイ安全性 | stateless ✓、ロールバック ✓、blue-green 時 in-flight WS 切断 risk |
| B | スケーラビリティ | 水平展開可、多 process 時 Redis pub/sub 必要、現在は単一 process (in-memory projectsToPeers map) |
| B | 障害復旧 | DB backup/restore は Infra、edit_sessions DB 記録で復旧可能、in-flight WS op 損失リスク |
| B | 依存関係管理 | package.json 主要依存、Dependabot 未設定、CVE スキャン CI 未統合 |

### チェック項目
- [ ] 構造化ロギング: console から JSON-L / pino 推奨
- [ ] メトリクス: prometheus 未実装 (v0.2)
- [x] ヘルスチェック: /api/health ✓
- [x] ロールバック可能
- [ ] 設定 hot-reload: 部分的 (env は起動時のみ)
- [ ] リソース制限: pool size / timeout 値が .env 不透明
- [ ] 水平展開: WS relay 未実装
- [ ] バックアップ/復旧: 文書化なし
- [ ] SLI/SLO: 未定義
- [ ] ランブック: なし

**小計: B**

## 総合評価

| # | 観点 | 評価 |
|---|------|------|
| 1 | データスキーマ | A (domain validation stub 1) |
| 2 | SRE | B (observability/deploy/scale 3) |

**評価: B**
