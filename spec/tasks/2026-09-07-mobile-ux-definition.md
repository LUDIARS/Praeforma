---
task: mobile-ux-definition
project: Praeforma
kind: 実装
created: 2026-09-07
memory_links:
  - spec/feature/ux-core-design.md
---
# スマホで UX 定義の入力を始められるようにする

## 目的
人間が UX の文章を自分で定義し、PC・スマホから編集と保存を進められるようにする。

## 完了条件
- UX 定義を初期ビューにし、画面キャンバスを開かずに文章を扱える。
- 新規作成・編集とも状況、目的、成功条件を複数行で入力できる。
- スマホ幅では入力欄を1列にし、操作領域と文字サイズを確保する。
- スマホからの接続は人間が指定した範囲に合わせ、認証なしの外部公開を勝手に行わない。
- テストと起動操作はユーザーの明示指示に従う。

## スコープ (編集可ディレクトリ)
- web/src/pages/
- web/src/components/ux-design/
- web/src/styles/
- spec/feature/
- スマホ接続設定は利用範囲の回答後に確定する。
