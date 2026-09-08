---
task: project-design-navigation
project: Praeforma
kind: 実装
created: 2026-09-08
memory_links:
  - spec/feature/project-registration.md
  - spec/feature/ux-core-design.md
  - spec/feature/screen-flow.md
  - spec/feature/data-design.md
---

# プロジェクトの設計メニューとシナリオ選択を整理する

## 目的

データ設計・遷移図を共通タブに揃え、UXデザインではシナリオを選んで編集できるようにする。

## 作業

1. データ設計と遷移図を4タブ＋その他へ追加し、直接URLと履歴移動に対応する。
2. ScreenFlowをUXデザインの横に配置し、旧ScreenFlowと要件定義モードを維持する。
3. TODO一覧を概要へ移し、既存シナリオ選択と名前・根拠を伴う新規シナリオ入力へ接続する。
4. UXデザインのシナリオをプルダウンで選択し、カード横並びとviewport固定幅によるはみ出しを解消する。
5. Revisor確認後、本体のビルドと配信確認で反映する。

## 完了条件

- 全8項目へ共通メニューから移動でき、タブバーは常に1個・通常4タブである。
- データ設計の既存URLも開け、遷移図を単独で表示・ダウンロードできる。
- UXデザインにTODO一覧を重複表示せず、概要のTODOから入力・編集へ進める。
- 狭い画面や長いシナリオ名でも選択部が横にはみ出さない。
- 旧ScreenFlowと要件定義モードが引き続き利用できる。

## スコープ

Praeformaのweb/とspec/。サービスの起動・反映確認はConcordia claim下でプロジェクト本体フォルダとExcubitorの手順に従う。
