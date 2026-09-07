---
task: reflect-project-ux-goal-and-register-mp
project: Praeforma
kind: 運用
created: 2026-09-08
memory_links:
  - spec/feature/project-ux-goal.md
---

# UX/Goalを稼働Pfに反映し、Mpの上位目標を登録する

## 目的

Overview右のUX/Goalで、スマホから最上位の体験・設計・ゴールを記述できるようにする。
既存のMpシナリオとは別に、necoの決定を出典付きで上位定義へ整理する。

## 作業

1. 実checkout、マージ済み変更、稼働版、SQLite/Postgresの移行方法を確認する。
   起動・反映が許可された範囲でビルドと追加列を適用する。起動・再起動はCcへclaimし、
   Ex経由でPraeforma本体フォルダから行う。worktreeから起動しない。終了後releaseする。
2. Mpプロジェクトを名前とanatomiaRepo=makainuipictorで照合する。既存のUX/Goalを読み、
   入力があれば上書きせず内容を突合する。空欄なら下記の登録内容をexpectedRevision付きで保存する。
3. 保存値を読み直し、出典と三欄を照合する。実機のUX評価や境界承認とは区別して報告する。

## Mpの登録内容

出典はMpのdocs/monster-presence-ddd-20260907、commit
4d0bd22e9e0ba1c3e20fcf4b287990eb86d79029のspec/ux/product.mdとspec/architecture/ddd.md。
現在の正本の版を再照合し、古い捕獲中心の別案と混同しない。

- 目指す体験：魔物の実在性を追求する。主コンテンツは自宅で魔物を飼うこと。
- 体験の設計：実在性の高い魔物を投げ縄で連れ帰り、自宅で同じ個体の様子を見て、世話をし、
  反応を受け取り、関係を続ける。「飼育・関係性」がコア責務。細部は設計案・未決定を区別する。
- ゴール：同じ空間に魔物が存在すると感じ、働きかけに応答が返り、状態や関わりが続く
  「この個体」と感じられる状態。UX-MP-W1/W2/W3の評価案であり、評価済みとはしない。

## 受入条件

- 稼働PfでOverviewの右にUX/Goalがあり、三欄を保存・再取得できる。
- Mpの定義に出典が残り、既存のシナリオ・ドメイン・他プロジェクトを破壊しない。
- テストや起動は明示許可の範囲に限る。未実施のスマホ評価を実施済みとしない。
- 進行状態はCcのtaskflow_task_stateで管理し、この文書へ書き戻さない。
