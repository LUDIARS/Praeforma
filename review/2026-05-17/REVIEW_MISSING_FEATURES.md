# 不足機能評価 — Praeforma v0.1 (2026-05-17)

## 1. 機能改善提案

| 対象機能 | 改善提案 | 期待効果 | 優先度 |
|---------|---------|---------|--------|
| spec list 検索 | `?search=&category=behavior` 追加 | 1000+ spec project の UI 速度 | High |
| domain 継承 validation | resolveInheritedAttrs() 実装 | Player domain は hp/speed 必須を強制 | High |
| acceptance result cache | Etag/304 Not Modified | polling bandwidth 削減 | Medium |
| WS ping/pong timeout | server-side 5min idle + graceful disconnect | zombie connection cleanup | Medium |
| reference_content rate limit | per IP / per token | quota 超過防止 | Medium |
| audit_log filtering | `?action=&actor=&from=&to=` | 監視/規定 report | Low |

## 2. 不足機能の提案

| 提案機能 | 必要性 | 優先度 | 影響範囲 |
|---------|--------|--------|---------|
| Unit / Integration テスト | optimistic lock 失敗、bulk update edge case が manual curl のみ | High | server/ + CI |
| Unity runtime probe | Step 9 stub 状態、FeedbackMarker gizmo のみ | High | Packages/jp.ludiars.praeforma/Runtime/probe.cs |
| WebSocket collab 2-client test | BACKLOG TODO、race condition / op order 未検証 | High | web/ E2E (Playwright/Cypress) |
| CHANGELOG.md | 配布履歴、breaking change、migration guide 未記録 | Medium | root/ + Packages/*/CHANGELOG |
| Development setup guide | env setup 時間消費 | Medium | CONTRIBUTING.md, .env.example 拡大 |
| Domain attribute inheritance test | parent → child 継承検証 | Medium | server/ test/integration/ |
| Asset presign actual S3 adapter | 現在 stub、MinIO/S3 連携必要 | Medium | server/src/storage/s3-adapter.ts (v0.2) |
| reference_content URL whitelisting | 内部サービスアクセス防止 | Medium | reference-content.ts + spec/schema/reference.md |
| Project export/import workflow | YAML スナップショットで git diff 管理 | Low | server/src/routes/export.ts + web UI |
| Acceptance probe expression sandbox | client-only eval → server-side vm2/QuickJS | Low | server/src/lib/assertion-evaluator.ts |

## 総合評価

| # | 観点 | 指摘数 | 優先度別 |
|---|------|--------|---------|
| 1 | 機能改善 | 6 | High: 2 / Medium: 3 / Low: 1 |
| 2 | 不足機能 | 9 | High: 3 / Medium: 5 / Low: 1 |
