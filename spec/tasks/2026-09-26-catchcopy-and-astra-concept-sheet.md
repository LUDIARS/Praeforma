---
task: catchcopy-and-astra-concept-sheet
project: Praeforma
kind: 実装
created: 2026-09-26
memory_links:
  - spec/feature/concept-sheet.md
  - spec/feature/project-ux-goal.md
  - spec/schema/concept-sheets.md
---
# キャッチコピー欄を足し、企画概要書を Astra で作る

Concordia director case `dir_87879bf78a7b4f32aeb217323e4bd97e` のプラン v1（2026-09-26 承認）のタスク分解。

## 目的

- キャッチコピーは人が考えた方が精度が高い。UX/ゴールに「キャッチコピー」欄を置き、企画概要書はその文言をそのまま採用する。
- 欄が空のときだけ Astra が案を作って埋める。AI が埋めたものは「AI案」と表示し、人が書き換えたら人の文言として扱う。
- 企画概要書を Astra で作る形に仕上げる（画面の候補から一番いいシーンを選んで明記・項目の出し分け・デザインされた 1 枚）。

## タスク分解

1. migration 019: projects に ux_catchcopy と ux_catchcopy_origin（'' / human / ai）を追加。Drizzle schema・spec を更新。
2. UX/ゴール API: catchcopy を任意項目で受ける。人の保存は origin=human、空にしたら origin を空へ。
3. UX/ゴール画面: キャッチコピー欄と「AI案」表示。
4. 企画概要書の生成を Astra に切り替える: 入力検証（画面の候補）、Astra 呼び出し、紙面の検査と作り直し 1 回、
   キャッチコピーの固定と空欄時の書き込み。生成は裏で走らせ、画面は状態を問い合わせる。
5. 企画概要書の画面: 画面の候補の選択、作り直しの指示、生成の待ち受け、プレビュー、一覧の表示項目。
6. skills/concept-sheet: 決まったキャッチコピーを変えない規則を足す。
7. 仕様とテスト（入力検証・紙面の検査・キャッチコピーの固定と空欄時の扱い・生成の状態）。
8. local PR を Revisor へ提出。マージ・反映は指示を受けてから。

## 完了条件

- [spec/feature/concept-sheet.md](../feature/concept-sheet.md) PF-CS-1〜9 と
  [spec/feature/project-ux-goal.md](../feature/project-ux-goal.md) PF-GOAL-W3 を満たす。
- server / web の型チェックが通る。単体・動作テストは明示の許可があるときに行う。
- 反映後、各プロジェクトのキャッチコピー（人の文言）を UX/ゴールに入れ、企画概要書を Pf の一覧に作る（データ作業。文言は公開リポに書かない）。
