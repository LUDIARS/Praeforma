---
task: concept-sheet-versions-and-visuals
project: Praeforma
kind: 実装
created: 2026-09-26
actio: actio:a1e75965-8e89-4d72-ab09-8347e567c470
memory_links:
  - spec/feature/concept-sheet.md
  - spec/feature/project-visuals.md
  - spec/schema/concept-sheets.md
  - spec/schema/project-visuals.md
---
# 企画概要書を版 (rv) で残し、UX・仕様の変化で更新する + ビジュアル素材の登録

Concordia director case `dir_301c30df40ef477794425c40db092063` の承認済み計画（2026-09-26）のタスク分解。
Actio タスク `actio:a1e75965-8e89-4d72-ab09-8347e567c470`（委託 run `96203644-ac1d-456f-afdc-325bc299e375`）。

## 目的

- 作った企画概要書を rv1 として残し、作り直し・自動更新のたびに rv2, rv3… と版を重ねる。
- 企画概要書は UX（企画の制約を含む）や仕様が変わるたびに更新される（最後の変更から 10 分静かになったら 1 回）。
- コンセプトアート・キービジュアル・ゲームプレイ時の一番面白そうなスクリーンショットを登録し、企画概要書の候補に使う。

## タスク分解

1. migration 021: `project_visuals` 表、`concept_sheet_versions` 表、`concept_sheets` に自動更新の ON/OFF と最新版の番号。
   既存の行は rv1 として版に写す（Postgres は migration、SQLite は起動時に同じ冪等な処理）。
2. ビジュアル API（登録・一覧・1 枚・更新・削除、版が使うものは画像を残す）と「ビジュアル」タブ。
3. 企画概要書の版: 生成・作り直しで版を足す、版の一覧と取得、画面で切り替え（印刷・HTML 保存もその版）。一覧は最新版。
4. 作成画面をビジュアルからの選択に替える（既定: キービジュアル → 一押し → コンセプトアート。新しい画像はビジュアルにも登録）。
5. 自動更新: UX 保存・制約・仕様・ビジュアルの変更を受けて予約し、10 分静かになったら作り直す。1 プロジェクト 1 本・全体 2 本、
   人の作り直しと同時に走らせない。失敗は理由を残し次の変更で再試行。状態の表示と ON/OFF。起動時の予約し直し・終了時の解除。
6. 材料に仕様の見出し・分類・状態を足す（本文は入れない、上限 100 件、鮮度の digest にも入れる）。スキル・spec を合わせる。
7. テストと仕様。Revisor へ local PR を提出。マージ・反映は指示を受けてから。

## 完了条件

- [spec/feature/concept-sheet.md](../feature/concept-sheet.md) PF-CS-10〜12（と更新した PF-CS-1〜9）、
  [spec/feature/project-visuals.md](../feature/project-visuals.md) PF-VIS-1〜6 を満たす。
- 既存のデータは消えない（追加の表・列のみ）。今ある企画概要書はその行の版を rv1 として引き継ぐ。
- server / web の型チェックが通る。単体・動作テストは明示の許可があるときに行う（Revisor が回す）。

## コード外の作業（親セッションが行う。コードに含めない）

- 2026-09-26 に Astra で作った 5 企画の企画概要書を、使った画面の画像ごと各プロジェクトの rv1 として取り込む。
  サーバの保存処理（ビジュアルの登録 `insertProjectVisual` と、版の保存 `persistConceptSheetVersion`）を使う一回きりの手順。
  非公開の企画を含むので公開リポには置かない。
- 取り込みは、今動いている古いサーバを入れ替えた後に行う（旧コードは新しい形の行を読めず一覧が壊れるため）。
  取り込んだ後に UX へ人のキャッチコピーを入れるので、rv1 は「UXが更新済み」になり、次の自動更新で rv2 になる。
- Astra は Codex の認証が切れている間は動かない。その間の自動更新は失敗として状態に残り、再ログイン後の次の変更で走る。
