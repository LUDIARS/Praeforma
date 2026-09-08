---
task: spec-reconstruction
project: Praeforma
kind: 実装
created: 2026-09-08
memory_links:
  - spec/feature/deferred-planning.md
  - spec/data/schema/deferred-planning.md
---

# レコンストラクションで仕様を再構築して版を上げる

## 目的

断片と既存の構造化仕様から、一貫した新しい仕様セットを作る。

## 作業

1. fragment-storeの保存基盤を前提に、基準版と入力断片集合を固定した実行・生成案を保存する。
2. 既存LLM連携を用いて統合・分割・訂正・不要・未解決を出力し、元断片と構造化仕様の対応を検証する。
3. 確定方式の確認後、基準版比較・新仕様・統合対応・版加算を単一トランザクションで実装する。
4. 差分・過去版・未解決の矛盾を表示し、同じ確定の再送と同時再構築で二重に版が上がらないようにする。

## 完了条件

既存仕様と追加断片を統合して版が1回上がり、入力と変更の根拠を追える。失敗・競合・取消では正規版を変えない。

## スコープ

Praeformaのserver/・web/・shared/・spec/。 Revisorで契約と回帰を確認し、反映・起動確認はConcordia claim下でプロジェクト本体とExcubitorの手順に従う。

