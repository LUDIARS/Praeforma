---
task: ux-design-pr-1448-reconciliation
project: Praeforma
kind: 調査
created: 2026-09-08
memory_links:
  - spec/feature/ux-core-design.md
  - spec/tasks/2026-09-07-ux-core-design-tool.md
---

# UX設計の取り込み実体と旧PR 1448を整合させる

## 目的

UXシナリオ・コアドメイン設計機能が未反映に見える状態を解消し、取り込み済み実装と重複する旧レビューを整理する。

## 調査根拠

旧レビューはRevisorローカルID deed403d-bb0d-478d-9a0e-867c3d21f026、ブランチfeat/ux-core-design。実装コミットce25ea3とレビュー修正f23f842を、mainのdecf89abe6d6ae4b92200c2d5e2521254a604c1eと比較した。機能本体は別レビュー68e4a585-3592-4e2b-ba1e-37c15bfdd0f4から取り込まれており、main側にはレビュー権限の制約、同時刻の判断の順序確定、版が異なる下書きの保持が追加されている。旧ブランチをそのまま採用するとこれらを失うため、単純な上書きは行わない。

## 作業

1. 着手時の旧ブランチとmainを再照合し、その後の独自変更がないか確認する。
2. プロジェクト画面の「UX / Core Domain Design」から /projects/:pid/ux-design に進めることと、UXシナリオ・境界設計機能の配信内容を確認する。
3. 未取り込みの独自変更があれば、その差分だけをmain起点の専用worktreeへ移し、既存の権限・判断順序・下書き保護を維持してRevisorへ提出する。
4. 独自変更がなければ、取り込み先の根拠を添えて旧レビューをCc/Revisorの正規手順で整理する。必要な権限や確認はその手順に従う。

## 完了条件

- 未取り込みの独自機能の有無を説明できる。
- 取り込み済みUX設計画面の導線と配信内容を確認できる。
- 重複レビューが未取り込みの機能として残らず、現行mainの修正を失わない。

## スコープ

PraeformaのUX設計関連ファイルと仕様、Cc/Revisorの該当ローカルレビューのみ。起動・反映確認はConcordiaのclaim下で、本体フォルダとExcubitorの手順に従う。
