---
task: fragment-store
project: Praeforma
kind: 実装
created: 2026-09-08
memory_links:
  - spec/feature/deferred-planning.md
  - spec/data/schema/deferred-planning.md
---

# フラグメント原文と出所を保存する

## 目的

仕様画面と連携機能の基盤として、プロジェクト単位のフラグメントを保存する。

## 作業

1. フラグメントのID・原文・出所イベントID・作者参照・訂正関係と処理結果を定義し、PostgreSQL/SQLiteの移行を追加する。
2. 未分類の自由入力を登録・一覧・詳細表示できるAPIを追加する。構造化仕様のドメイン必須とは区別する。
3. 受信元とイベントIDによる一意性、別プロジェクトの拒否、原文をログへ出さない契約を担保する。
4. 既存仕様を出自付きの構造化仕様として扱う移行を定義し、承認状態と編集版を維持する。

## 完了条件

同じイベントの再送で重複せず、未分類の指示を保存・再読込できる。既存の仕様や版を失わない。

## スコープ

Praeformaのserver/・web/・shared/・spec/。 Revisorで契約と回帰を確認し、反映・起動確認はConcordia claim下でプロジェクト本体とExcubitorの手順に従う。

