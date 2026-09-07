---
task: domain-todo-ux-entry
project: Praeforma
kind: 実装
created: 2026-09-07
memory_links:
  - spec/feature/ux-definition-todos.md
---
# 実装の整理TODOからUXを定義する入口

## 目的
既存実装の未定義・対応付け不足をリストから選び、人間がUXとドメインを整理できるようにする。

## 完了条件
- Anatomiaの未所属コード・目的未定義・実装対応付け不足を根拠付きで取得する。
- 項目からUX作成と再開へ進み、元の参照を保存する。
- UX未着手の項目を先に表示する。
- 取得失敗と課題なし、UX保存と実装課題の解決を混同しない。
- 人間の代わりにコアドメイン認定・削除・ゲート承認を行わない。

## スコープ (編集可ディレクトリ)
- server/src/lib/ux-definition-todos.ts
- server/src/routes/
- web/src/components/ux-design/
- web/src/pages/UxCoreDesignPage.tsx
- web/src/styles/ux-design.css
- spec/feature/ux-definition-todos.md
