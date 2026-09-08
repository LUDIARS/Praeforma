---
task: design-llm-window
project: Praeforma
kind: 実装
created: 2026-09-08
memory_links:
  - spec/feature/deferred-planning.md
  - spec/data/schema/deferred-planning.md
---

# 設計中に常時使えるLLM相談ウインドウを設ける

## 目的

Pfの設計画面を操作しながらAIに相談できる専用の表示面を作る。

## 作業

1. 最前面の範囲がPf内かOS上の独立ウインドウかを確認し、その方式を採用する。
2. プロジェクト単位の会話保存とLLM応答を既存接続へ実装し、送信失敗・取消・再送を扱う。
3. 常時表示・移動・サイズ変更・折り畳みと、画面移動後の会話継続を実装する。
4. 仕様指示をfragment-storeへ原文と出所付きで登録し、会話から元断片と構造化結果へ進める。

## 完了条件

合意した最前面方式で相談と設計を同時に行え、プロジェクト間で会話が混ざらず、失敗時にも指示を失わない。

## スコープ

Praeformaのserver/・web/・shared/・spec/。 Revisorで契約と回帰を確認し、反映・起動確認はConcordia claim下でプロジェクト本体とExcubitorの手順に従う。

