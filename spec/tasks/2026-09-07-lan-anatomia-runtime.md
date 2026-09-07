---
task: lan-anatomia-runtime
project: Praeforma
kind: 実装
created: 2026-09-07
memory_links:
  - spec/feature/local-mode.md
  - spec/feature/ux-definition-todos.md
---
# Pf のマージ済みUIをAnatomiaとLANのスマホへ接続する

## 目的
TODO一覧から人間がUXを定義する流れを、本体と同じLANのスマホで利用可能にする。

## 完了条件
- 本体checkoutを既存差分保全の上でマージ済み内容へ整合させる。
- Ex topologyからAnatomia接続先を受け取り、対象プロジェクトを関連付ける。
- LANの特定プライベートIPだけにbindし、他Originのアクセスを拒否する。
- Cc claim後にExから本体を反映し、TODO取得とUX保存・再取得を確認する。
- スマホ実機を操作できない場合は、確認範囲を区別して報告する。

## スコープ (編集可ディレクトリ)
- server/src/config.ts
- server/src/index.ts
- server/src/lib/local-access.ts
- excubitor.catalog.yaml
- spec/feature/local-mode.md
