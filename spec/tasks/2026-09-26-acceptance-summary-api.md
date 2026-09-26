---
task: acceptance-summary-api
project: Praeforma
kind: 実装
created: 2026-09-26
actio: actio:5e0441b4-404f-4793-9198-e0fbfa140419
memory_links:
  - spec/feature/acceptance-summary.md
  - spec/data/schema/acceptance.md
---
# 受入状態の要約 API (`GET /api/projects/:pid/acceptance/summary`)

Actio タスク `actio:5e0441b4-404f-4793-9198-e0fbfa140419` (委託 run `1594fa0b-92c8-453b-95e7-471b0039948f`) のタスク分解。

## タスク分解

1. spec: `spec/feature/acceptance-summary.md` を追加し、spec-authoring ドメインの specRefs に載せる。
2. 純関数 `server/src/lib/acceptance-summary.ts` (最新 run 選択・run 状態別件数・結果集計・仕様版の整形)。
3. 読み取り `server/src/db/acceptance-summary-reads.ts` (ローカルモードは受入テーブルが無いので run 0 件)。
4. 経路 `makeAcceptanceSummaryRouter` を `server/src/routes/acceptance.ts` に追加し、両モードで載せる。
5. テスト: 純関数 (run 無し / 最新 run 選択 / 集計)、経路 (ローカル 200、トークン無し 401、非メンバー 403)。
