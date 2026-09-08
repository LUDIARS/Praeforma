---
task: spec-implementation-view
project: Praeforma
kind: 実装
created: 2026-09-08
memory_links:
  - spec/feature/deferred-planning.md
  - spec/data/schema/deferred-planning.md
---

# 仕様をフラグメントとストラクチャードに分けて実装状態を管理する

## 目的

仕様画面を考案から構造化・実装確認まで使えるようにする。

## 作業

1. fragment-storeの保存契約に接続し、仕様画面をフラグメント/ストラクチャードで切り替える。
2. 実装済/未実装の更新・絞り込みと版付き根拠を追加する。既存データの不明状態を実装済と推測しない。
3. 承認状態・実装状態・統合状態を別軸で表示し、フラグメントの統合先や不要になった理由へ進める。
4. Pfで仕様を指示する既存登録経路を洗い出し、元の指示を欠落なくフラグメントへ登録する。

## 完了条件

仕様画面で両分類と実装状態を管理でき、構造化と実装完了を混同しない。登録の失敗・再送で指示を失わない。

## スコープ

Praeformaのserver/・web/・shared/・spec/。 Revisorで契約と回帰を確認し、反映・起動確認はConcordia claim下でプロジェクト本体とExcubitorの手順に従う。

