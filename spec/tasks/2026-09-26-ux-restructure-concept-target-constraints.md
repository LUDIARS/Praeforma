---
task: ux-restructure-concept-target-constraints
project: Praeforma
kind: 実装
created: 2026-09-26
memory_links:
  - spec/feature/project-ux-goal.md
  - spec/feature/project-constraints.md
  - spec/feature/concept-sheet.md
  - spec/schema/project-constraints.md
---
# UX の構成を変える（価値/コンセプト・ターゲット・ジャーニー、シナリオ、制約）

Concordia director case `dir_61f9bf5b790247c28f783f2aa27bad05` のプラン v1（2026-09-26 承認）のタスク分解。

## 目的

- 「UX」はふわっとした言葉なので、UX タブの軸を **目指す価値/コンセプト**（= キャッチコピー、1 行）にする。
- **ターゲットユーザー** と **カスタマージャーニー（遊び方/使われ方）** を定義する。
- インゲームの詳しいフローは、いまの「UXデザイン」を **シナリオ** として扱う。
- **制約** タブを足し、企画的な制約は UX を縛るものとして UX タブに表示する。

## タスク分解

1. migration 020: projects.ux_target 追加、project_constraints 表。Drizzle schema・spec/schema。
2. UX API: target を任意項目で受ける。キャッチコピー（価値/コンセプト）の改行を拒否。
3. 制約 API: /api/projects/:pid/constraints（一覧・作成・更新・削除、版一致、権限は UX と同じ）。
4. UX タブの並べ替えと名前替え、縛る制約の表示、詳細の折りたたみ。
5. 制約タブ。
6. 「UXデザイン」→「シナリオ」（ボタン・見出し・タブ）。
7. 企画概要書の材料・スキル・spec を新構成に合わせる。
8. テストと仕様。local PR を Revisor へ提出。マージ・反映は指示を受けてから。

## 完了条件

- [spec/feature/project-ux-goal.md](../feature/project-ux-goal.md) PF-GOAL-W4、
  [spec/feature/project-constraints.md](../feature/project-constraints.md) PF-CON-1〜4、
  [spec/feature/concept-sheet.md](../feature/concept-sheet.md) PF-CS-1 / PF-CS-7 を満たす。
- 既存プロジェクトの文章は消えない（追加列・追加表のみ）。
- server / web の型チェックが通る。単体・動作テストは明示の許可があるときに行う。
