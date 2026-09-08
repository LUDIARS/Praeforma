---
task: "[Pf] 仕様画面のレコンストラクションとバージョンログ"
project: Pf
kind: implementation
created: 2026-09-08
memory_links: []
---

## 目的

仕様画面でフラグメントと既存仕様を統合し、変更の経緯とリリース単位を追えるようにする。

## 実装範囲

[機能仕様](../feature/spec-reconstruction.md) PF-RECON-1〜5、[保存契約](../schema/spec-versioning.md)。AI案の作成、Pf内での前後比較と確定、出典保持、保留理由、追加/再構築/リリースの履歴表示。

## 受け入れ条件

- フラグメント追加で0.0.1、確定で0.1.0、次の追加で0.1.1、リリースで1.0.0となる。
- 同じ登録の再送や確定の再送で履歴が重複しない。
- 確認中に入力が変わった場合は確定を拒否し、途中の仕様や履歴を残さない。
- 履歴から変わった仕様と出典フラグメントを確認できる。
- プロジェクト境界と閲覧/編集権限を守る。

## 検証

型検査・Webビルド。`server/src/lib/__tests__/spec-versioning.test.ts` に番号遷移、再送、案の確定、出典保持、古い案、権限を検証するケースを置く。実行はRevisorへ委ねる。本体への反映はExcubitorとConcordia testing claimを利用する。
