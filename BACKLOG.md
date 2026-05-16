# Praeforma — Backlog

設計フェーズ完了時点 (2026-05-16) の残課題インデックス。 優先度は他プロジェクト
(Memoria / Cernere 等) より少し下、 着手は様子見。

## 仕様 stub (spec/ 配下、 着手前に詰める)

| # | 項目 | spec | 説明 |
|---|---|---|---|
| S1 | API 契約 (REST + WS) | [spec/api/README.md](spec/api/README.md) | schema を元に REST + WebSocket 契約を起こす |
| S2 | acceptance input script フォーマット | [spec/acceptance-script.md](spec/acceptance-script.md) | 「W を 1s 押す」 を再現可能に書く言語 |
| S3 | MVP 実装の着手順 | [spec/mvp-plan.md](spec/mvp-plan.md) | server / frontend / unity の scaffold 順序 |
| S4 | CLI 整備 | [spec/cli.md](spec/cli.md) | `praeforma export ... ` 系 |
| S5 | 既存ツール (Notion + Figma + Unity) との差分 | [spec/competitive.md](spec/competitive.md) | sales pitch / 差分明示 |

## 外部依存 (別リポ Issue)

| # | 項目 | リポ | 状態 |
|---|---|---|---|
| X1 | `Pf = Praeforma` を PROJECT-CODES.md に追記 | LUDIARS/LUDIARS | [Issue #7](https://github.com/LUDIARS/LUDIARS/issues/7) |

## 実装 (= まだ着手しない / Issue は不要)

| 項目 | 備考 |
|---|---|
| Postgres + Drizzle scaffold | S3 で順序決定後 |
| Hono server scaffold | 同上 |
| React + Vite frontend scaffold | 同上 |
| Unity UPM パッケージ scaffold | 同上 |
| migrations 001_init.sql | schema spec が確定したら一括生成 |
| GitHub リポジトリ作成 | 実装着手する直前 (= 今は不要) |

## 優先度評価 (4 軸)

| 軸 | 評価 |
|---|---|
| AI 学習量 | 低 (= 既存 LUDIARS パターン (Cernere/Actio) の流用、 新規学習要素は少ない) |
| 作業コスト | 中 (= server + frontend + unity 3 系の scaffold、 acceptance runner が新規) |
| 目的達成度 | 中 (= 1 プロジェクト触れば「企画 → 試作 → 仕上げ」 のフィードバックが返る) |
| 主目的との一致度 | 低 (= LUDIARS の中心 (Cernere / Memoria) と直交、 ゲーム開発支援は branch task) |

= 「他が落ち着いたら着手」 のレーン。 急ぎ理由が出るまで設計のまま。
