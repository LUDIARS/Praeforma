# ビジュアル素材（コンセプトアート / キービジュアル / スクリーンショット）

2026-09-26 neco 指示「コンセプトアートやキービジュアル、ゲームプレイ時の 1 番面白そうなスクリーンショットを登録できるようにする」
（Concordia director case `dir_301c30df40ef477794425c40db092063` の承認済み計画）。

プロジェクトの「ビジュアル」タブで、企画の見た目を伝える画像を登録する。企画概要書（[concept-sheet.md](concept-sheet.md)）は、
ここから画面の候補を選んで作る（PF-CS-12）。

## 要件

- PF-VIS-1: ビジュアルは 種類（キービジュアル `key_visual` / コンセプトアート `concept_art` / スクリーンショット `screenshot`、
  ゲームプレイ・ツール画面）・名前（1 行・60 字まで。紙面に「現在の画面：名前」として載る）・メモ（任意・1000 字まで。何の場面か・見どころ）・
  一押し（一番面白そうな画面の印。複数に付けられる）を持つ。登録・名前やメモや種類の変更・一押しの付け外し・削除ができる。
  タブは種類ごとに、登録した順に並べる。
- PF-VIS-2: 画像は PNG / JPEG / WebP、1 枚 4MB まで。種類の申告と画像の先頭のバイトが一致しないものは受け付けない
  （企画概要書の画面の候補と同じ確認、`server/src/lib/concept-sheet-input.ts`）。1 プロジェクト 30 枚まで（削除したものは数えない）。
  既存の assets は保存先が仮実装（stub）で画像を置けないため、企画概要書と同じく画像を DB に持つ。画像の中身は登録後に変えない
  （差し替えは新しく登録して古いものを消す）。
- PF-VIS-3: 更新・削除は版一致（expectedRevision）で行い、古い版での上書き・削除は 409 にする。プロジェクトごとに分離する
  （別プロジェクトのビジュアルは見えず、更新・削除もできない、404）。保存の失敗や競合で入力を消さない。
- PF-VIS-4: 企画概要書のどれかの版が使ったビジュアルは、削除しても画像を残す（削除済みの印を付け、タブ・候補には出さない）。
  古い版の紙面から画像が消えないようにするため。どの版も使っていないものは行ごと消す。企画概要書を消して、どの版も使わなくなった
  削除済みの行は片付ける。
- PF-VIS-5: 企画概要書の候補の既定は キービジュアル → 一押し → コンセプトアート の順（それぞれ新しく登録した順）に最大 6 枚
  （`shared/project-visual.ts` の `defaultCandidateVisualIds`）。一押しでないスクリーンショットだけのときは既定は空で、人が選ぶ。
- PF-VIS-6: ビジュアルの更新・削除は、企画概要書の自動更新へ知らせる（PF-CS-11）。使っているビジュアルの名前・種類・メモ・削除だけが
  シートを古くする（一押しの付け外しでは古くならない、PF-CS-7）。登録だけでは知らせない（使っているシートが無いため）。

閲覧はプロジェクトメンバー全員。登録・更新・削除は owner / planner / designer（企画概要書を作れる人と同じ）。

## API

`/api/projects/:pid/visuals`

| 操作 | 内容 |
|---|---|
| `GET /` | 一覧（削除していないもの、画像の中身は含めない）。`{canEdit, max, items:[{id,kind,label,note,featured,mimeType,byteSize,digest,revision,createdAt,updatedAt}]}` |
| `GET /:id` | 1 枚を画像ごと。`{visual:{…, dataUrl}}`。画面は見えている分だけ読み、中身は変わらないので使い回す |
| `POST /` | `{kind, label, note?, featured?, dataUrl}`。201 `{visual}`。上限を超えたら 422 `visual_limit_reached` |
| `PUT /:id` | `{kind, label, note, featured, expectedRevision}`。版不一致は 409 |
| `DELETE /:id?expectedRevision=` | 削除（版が使っていれば印だけを付けて画像を残す）。版不一致は 409、無ければ 404 |

保存形式は [spec/schema/project-visuals.md](../schema/project-visuals.md)。

## 実装

| ファイル | 責務 |
|---|---|
| shared/project-visual.ts | 種類・上限・型・候補の既定 |
| server/src/db/schema/project-visual.ts / server/src/db/project-visual-sqlite.ts | 表（Postgres / SQLite） |
| server/src/db/project-visual-persistence.ts | 上限つきの登録・版一致の更新・版が使うものを残す削除・片付け |
| server/src/db/project-visual-reads.ts | 一覧（画像を読まない）・1 枚・同じ画像の行 |
| server/src/routes/project-visuals.ts | 権限・入力の検証・自動更新への知らせ |
| web/src/lib/project-visuals-api.ts / web/src/lib/use-visual-image.ts | 呼び出しと失敗の言い換え、画像の読み込み |
| web/src/components/visuals/ProjectVisuals.tsx | ビジュアルタブ（種類ごとの一覧・登録の入口） |
| web/src/components/visuals/VisualCard.tsx | 1 枚の表示・直し・一押しの切り替え・削除 |
| web/src/components/visuals/VisualUploadForm.tsx | 1 枚の登録（送る前の種類と大きさの確認） |
| web/src/components/visuals/VisualFields.tsx | 種類・名前・メモ・一押しの入力欄 |
| web/src/components/visuals/VisualThumb.tsx | 縮小表示（見えるときに画像を読む） |
| web/src/components/ProjectTabs.tsx / web/src/pages/ProjectShowPage.tsx | 「ビジュアル」タブの追加 |
| web/src/components/concept-sheets/ConceptSheetCandidatePicker.tsx | 企画概要書の作成画面で候補を選ぶ・新しい画像を足す |

## 検証

`server/src/lib/__tests__/project-visuals.test.ts`（候補の既定の順・3 種類の登録・一覧に画像を含めない・名前の改行と画像の種類と大きさの拒否・
版一致の更新・別プロジェクト・権限・版が使うものを残す削除・30 枚の上限）と、企画概要書側の `concept-sheet-versions.test.ts`。
題材は架空の企画にする（公開リポのため）。単体・動作テストは明示の許可があるときに行う。
反映には本体での build と Excubitor 経由の再起動が要る（SQLite は起動時に表を作る、Postgres は migration 021）。
