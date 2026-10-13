# Praeforma 利用者向け説明 — 編集者向け README

共通契約: AIFormat `FORMAT_HANDBOOK.md` (handbook_version "1")。本ディレクトリは利用者向け原稿の正本。
利用者向け本文には内部ファイル構成・PR・ポートを書かない (ここだけに書く)。

## 目次

| order | id | 章 | status |
|---|---|---|---|
| 0 | overview | Praeforma を使い始める | draft |
| 10 | create-project | プロジェクトを作る | draft |
| 20 | fragments-to-specs | 断片を残して仕様にまとめる | draft |
| 30 | measurements-contracts | 仕様に数値目標と条件・報酬を書く | draft |

## 確認記録

- 2026-10-14 初版 (Actio eef4b458 / Memoria #2219)。照合した製品コミット: `7c93ed96b87f`。
- 確認方法: **静的確認のみ**。各章の `source_refs` の画面コードから表示名・必須項目・エラー文・権限を照合した。
  実際の画面操作での確認 (実操作確認) は未実施。
- 現行 UX 定義 (`spec/ux/`) は本リポに無く、目的は `spec/feature/deferred-planning.md` と画面の説明文から取った。

## 未確認・未対応

- `contexts.json` の key は原稿側で決めた意味 ID。**画面側への配線 (ヘルプ入口から章を開く) は未実装**。
- 既存の「機能説明書」(`spec/feature/feature-manual.md`、仕様タブの「説明書」) は機能ごとの詳細説明で、
  本原稿 (最初の成功と日常操作の入口) とは役割が別。統合の要否は未判断。
- 対象外の章: UX・シナリオ・制約・ドメイン・アクター・シーン・データ設計・遷移図・ビジュアル・企画概要書。
  画面は存在するが、本初版では最初の成功に必要な範囲に絞った。
- 「チーム ID」の入手先 (ローカルモードでの既定値の有無) は未確認。
- 公開 (`status: published`) の承認は未実施。原稿作成・PR は公開承認ではない。
