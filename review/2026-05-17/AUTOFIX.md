# AUTOFIX.md

## 概要
- 修正ファイル数: 0
- 変更行数: +0 / -0
- カテゴリ別件数: lint=1 / typo=0 / unused_import=1 / dead_code=0 / gitignore=1 / toc=1
- 関連 PR: なし

## 修正対象なし (本日は自動修正 PR 作成見送り)

## フラグしたが手作業に回した指摘

- **lint**: server/src/index.ts:91 — duplicate route mount (`/api/projects/:pid/references` 二重)。references/:rid/content に分離
- **unused_import**: server/src/routes/acceptance.ts:24 — `specAcceptance` 不使用 (evaluation は event-buffer.ts)
- **lint**: server/src/ws/collab.ts:150+ — incomplete ping timer (`clearInterval` 不在、メモリ漏れ)
- **lint**: web/src/pages/LayoutEditorPage.tsx — error boundary 無し、component crash 時 fallback UI なし
- **lint**: Packages/jp.ludiars.praeforma/Editor/PraeformaWindow.cs — hardcoded port 8889、EditorPrefs で configurable に
- **gitignore**: Packages/jp.ludiars.praeforma node_modules 除外確認
- **toc**: spec/schema/README.md に 11 schema ファイル目次追加
- **lint**: server/migrations/001_init.sql — SQL formatting (tab vs space)、prettier-plugin-sql / sqlfluff

### 設計レベル変更 (手作業必須)

- reference_content URL whitelist + SSRF 防止 — REVIEW_VULNERABILITY.md High
- WS per-op authz check — REVIEW_VULNERABILITY.md Medium
- reference.url Zod URL format check — REVIEW_VULNERABILITY.md Medium
- spec_acceptance expression DSL whitelist — REVIEW_VULNERABILITY.md Medium
- domain.required_attrs resolver 実装 — REVIEW_MISSING_FEATURES.md High
- Unity runtime probe (Step 9) — REVIEW_MISSING_FEATURES.md High
- WS collab 2-client E2E test — REVIEW_MISSING_FEATURES.md High
- structured logging (pino + traceID) — REVIEW_IMPLEMENTATION.md SRE
- CHANGELOG.md / CONTRIBUTING.md / TROUBLESHOOTING.md — REVIEW_QUALITY.md §3

## 関連
- レビュー全文: REVIEW.md / REVIEW_*.md
- 修正 PR diff: なし
