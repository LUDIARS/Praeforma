---
task: cc-fragment-ingestion
project: Praeforma
kind: 実装
created: 2026-09-08
memory_links:
  - spec/feature/deferred-planning.md
  - spec/data/schema/deferred-planning.md
---

# Ccで受けた仕様指示をPfのフラグメントへ取り込む

## 目的

Ccで行った仕様指示もPfのデファードプランニングへ接続する。

## 作業

1. fragment-storeを前提に、Ccの正規指示イベントからPfプロジェクトへの対応と認証・イベントIDの契約を定義する。
2. Cc側の実装着手時はConcordiaを対象登録し、専用worktreeを作る。永続的な送信待ち記録を追加し、Pf停止時の再送を可能にする。
3. Pf受信口で重複防止・出所保存・プロジェクト権限を検証する。対象未確定の指示は未配送として見える形で保持する。
4. Discord/Lictor/Pfなど同じ原指示が複数経路で届く場合の共通イベント識別を確認し、自動通知を仕様指示と誤認しない。

## 完了条件

Cc由来の仕様指示がPfへ原文付きで登録され、停止・再送・複数配送で欠落や重複が起きない。

## スコープ

Praeformaの受信API・保存層・spec/とConcordiaの指示受付・配信処理。各リポの編集は個別の対象登録とworktreeで行う。 Revisorで契約と回帰を確認し、反映・起動確認はConcordia claim下でプロジェクト本体とExcubitorの手順に従う。

