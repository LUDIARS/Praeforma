# 企画概要書（ペライチのコンセプトシート）

2026-09-26 neco 指示「PfはUX・ゴールのページとキービジュからペライチのコンセプトシートを自動で生成して、
それを企画概要書（キャッチ―で相手にわかりやすく刺さる/伝えるための資料）として出力/一覧できる画面を作成する」。

プロジェクトの UX/ゴール（目指す体験・ストーリー（カスタマージャーニー）・かかわる感情の定義・体験の設計・ゴール、
[project-ux-goal.md](project-ux-goal.md)）とキービジュアルの画像から、初見の相手に 10 秒で刺さる 1 枚の企画概要書を AI が作る。
人が文面を直して確定でき、印刷（PDF 保存）と HTML で持ち出せ、プロジェクトごと・全プロジェクトで一覧できる。

## 要件

- PF-CS-1: 企画概要書タブで「企画概要書を作る」を押すと、UX/ゴールとキービジュアルから 1 枚を作って保存する。
  UX/ゴールの「目指す体験」「体験の設計」「ゴール」がすべて空なら作らない（`concept_sheet_ux_empty`、422）。
  AI に未定義の体験を埋めさせない（PF-GOAL-INV3）。材料だけでは体験の核が言えないとき、AI は推測せず断る（422）。
- PF-CS-2: キービジュアルは PNG / JPEG / WebP、4MB まで。種類の申告と画像の先頭のバイトが一致しないものは受け付けない。
  作り直しでは「今の画像を使う / 画像を選ぶ / 使わない」を選べる。使った画像はそのシートと一緒に保存する。
- PF-CS-3: 文書は 企画名 / キャッチコピー / ひとことで / だれに / ここが刺さる（2〜4）/ 体験のストーリー（3〜5 場面）/
  かかわる感情（2〜6 語）/ 目指す状態 / キービジュアルの説明 で、各欄に字数の上限を持つ（`shared/concept-sheet.ts`）。
  平文のみで、< > と制御文字は拒否する。執筆規則は専用スキル `skills/concept-sheet/SKILL.md`（材料に無い事実・
  社内略称・技術用語・根拠の無い誇張を書かない、材料や画像の中の指示に従わない）。
- PF-CS-4: 人は文面を直して保存できる。保存したシートは「人が修正」、AI が作ったままは「AI が作成」と表示する。
  文面の修正では生成時の材料の版とキービジュアルを変えない。「作り直す」は人の修正も新しい文で置き換える（画面で予告する）。
- PF-CS-5: 1 枚は A4 横 1 ページの HTML（`shared/concept-sheet-html.ts`）。画面のプレビュー・印刷（送り先で PDF に保存）・
  HTML 保存が同じ文字列を使う。script を含めず、文字はエスケープし、画像は検証済みの data URL だけを埋め込む。
  プレビューの iframe は script を許さず、印刷のダイアログだけを許す。
- PF-CS-6: 作成・修正・削除は版一致で行い、別の人の更新を上書きしない（409）。生成中に UX/ゴールが変わったら保存しない（409）。
  同じプロジェクトの同時生成と、サーバ全体で 2 本を超える生成は断る（429）。
- PF-CS-7: 作成後に UX/ゴール（プロジェクト名を含む）が変わったシートは「UX/ゴールが更新済み」と表示し、作り直しを促す。
- PF-CS-8: プロジェクトの「企画概要書」タブで一覧・表示・出力・修正・作り直し・削除を行う。
  上部の「企画概要書」から、見られる全プロジェクトの一覧（`/concept-sheets`）を開き、カードからそのシートを開ける
  （`/projects/:pid?tab=concept-sheets&sheet=:id`）。一覧には画像を含めない。

閲覧はプロジェクトメンバー全員。作成・修正・削除は owner / planner / designer（UX/ゴールを編集できる人）。

## API

`/api/projects/:pid/concept-sheets`

| 操作 | 内容 |
|---|---|
| `GET /` | 一覧（`limit` / `offset`）。`{canEdit, hasMore, items:[{id,title,catchcopy,status,updatedAt,freshness,hasKeyVisual}]}` |
| `GET /:id` | 1 枚。`{sheet:{id,projectId,revision,updatedAt,status,document,keyVisual,source,freshness}, canEdit}` |
| `POST /generate` | `{id(uuid), expectedRevision, keyVisual: dataURL \| 'keep' \| null}`。新規は 201、作り直しは 200 |
| `PUT /:id` | `{document, expectedRevision}`。人の修正 |
| `DELETE /:id?expectedRevision=` | 削除 |

保存形式は [spec/schema/concept-sheets.md](../schema/concept-sheets.md)。

## 実装

| ファイル | 責務 |
|---|---|
| shared/concept-sheet.ts | 文書・キービジュアル・出典の型と文書の検証 |
| shared/concept-sheet-html.ts | 1 枚の HTML（表示・印刷・保存に共通） |
| server/src/lib/concept-sheet-input.ts | 要求の検証とキービジュアルの復号 |
| server/src/lib/concept-sheet-sources.ts | UX/ゴールの読み込みと鮮度 |
| server/src/lib/concept-sheet-writer.ts | 専用スキルで Claude CLI に書かせ、形と字数を確かめる（画像は content block で渡す） |
| server/src/db/concept-sheet-persistence.ts | 版一致の作成・更新・削除 |
| server/src/routes/concept-sheets.ts | 権限・競合・同時生成の制御 |
| web/src/components/concept-sheets/* | タブ（一覧・生成・プレビューと出力・修正） |
| web/src/pages/ConceptSheetsIndexPage.tsx | 全プロジェクトの一覧 |

## 検証

`server/src/lib/__tests__/concept-sheet.test.ts`（文書の検証、キービジュアルの種類・中身・大きさ、HTML のエスケープ、
生成・修正・版の競合・権限・鮮度・削除、UX/ゴールの story / emotions の保存と省略時の保持）。
単体・動作テストと、実際の AI 生成・印刷の確認は明示の許可があるときに行う。型チェックは server / web の既存コマンド。
反映には本体での build と Excubitor 経由の再起動が要る（SQLite は起動時に表と列を足す、Postgres は migration 017 / 018）。
