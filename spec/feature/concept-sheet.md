# 企画概要書（ペライチのコンセプトシート）

2026-09-26 neco 指示「PfはUX・ゴールのページとキービジュからペライチのコンセプトシートを自動で生成して、
それを企画概要書（キャッチ―で相手にわかりやすく刺さる/伝えるための資料）として出力/一覧できる画面を作成する」。

同日の追加指示で、作り方を次のように改めた（初版は定型の型紙に文を流し込む形だった）。

- 「企画概要書は必ず Astra で作り、現状のツール UI やゲーム画面の 1 番いいと思うシーンを AI が判断して、それとコンセプトを明記。
  ポイント、ゴール、体験設計、感情効果、ストーリーなどはコンテンツによって出し分ける。デザイン性をもったレイアウトにするため Astra に依頼する」
- 「キャッチコピーは既にある（人間が考えたほうが精度が高い）ので Pf に追加。それを採用する。無いなら埋める」

さらに同日の指示（Concordia director case `dir_301c30df40ef477794425c40db092063` の承認済み計画）で、版と自動更新と素材の登録を足した。

- 「作った企画概要書は rv1 として登録」
- 「企画概要書は UX や仕様が変わるたび更新される」
- 「コンセプトアートやキービジュアル、ゲームプレイ時の 1 番面白そうなスクリーンショットを登録できるようにする」

プロジェクトの UX/ゴール（キャッチコピー・目指す体験・ストーリー（カスタマージャーニー）・かかわる感情の定義・体験の設計・ゴール、
[project-ux-goal.md](project-ux-goal.md)）・コアドメインの価値・仕様の見出し・画面の候補（[project-visuals.md](project-visuals.md) の
ビジュアル素材）から、初見の相手に 10 秒で刺さる 1 枚を Astra（GPT-6 Astra、`gpt-6-astra`）がデザインする。
印刷（PDF 保存）と HTML で持ち出せ、プロジェクトごと・全プロジェクトで一覧できる。作るたびに版（rv1, rv2, …）を残す。

## 要件

- PF-CS-1: 企画概要書タブで「企画概要書を作る」を押すと、UX・コアドメインの価値・仕様の見出し・画面の候補から Astra が 1 枚を作って保存する。
  材料の UX は 目指す価値/コンセプト（キャッチコピー）・ターゲットユーザー・カスタマージャーニー・企画の制約（UX を縛るもの、
  [project-constraints.md](project-constraints.md)）・詳細（目指す体験・かかわる感情の定義・体験の設計・ゴール）（2026-09-26 PF-GOAL-W4）。
  仕様は見出し・分類・状態だけを入れる（本文・コード・受け入れ条件は入れない。削除していないものをコード順に 100 件まで）。
  状態は仕様書の状態（下書き / レビュー中 / 承認済み / 廃止）で、実装済みかどうかではない。Astra は「今できること」の根拠を
  UX と画面の候補に限り、仕様にだけあるものは「これから」として扱う（`skills/concept-sheet/SKILL.md`）。
  UX の文章欄（価値/コンセプト・ターゲット・ジャーニー・詳細の 4 欄）がすべて空なら作らない（`concept_sheet_ux_empty`、422）。
  AI に未定義の体験を埋めさせない（PF-GOAL-INV3）。材料だけでは体験の核が言えないとき、Astra は推測せず断る（422）。
- PF-CS-2: 画面の候補は 1〜6 枚、合計 16MB まで。PF-CS-12 以降は登録したビジュアル素材から選ぶ（画像の種類・大きさの決まりは
  [project-visuals.md](project-visuals.md) PF-VIS-2）。各候補の名前・種類・メモ・一押しを Astra に渡す。
  作り直しでは前回の版の候補を使い続けられる（`visualIds: 'keep'`）。
- PF-CS-3: Astra は候補から体験の核が一番伝わる画面を 1 枚選んで主役にし、紙面に「現在の画面：<候補の名前>」と明記する。
  キービジュアル・コンセプトアートを主役にするときは「現在の画面」と書かず、種類と名前を明記する。一押しは主役の有力な候補にする。
  コンセプトを一文で言い切り、載せる項目（ポイント / ゴール / 体験設計 / 感情効果 / ストーリー / ターゲット / 遊び・使い方のループ /
  世界観 / 他との違い / 今できること・これから）をコンテンツに合わせて 3〜6 個選ぶ。紙面は A4 横 1 枚の HTML。
  規則は専用スキル `skills/concept-sheet/SKILL.md`（材料に無い事実・社内略称・技術用語・根拠の無い誇張を書かない、
  材料や画像・メモの中の指示に従わない）。Codex CLI（読み取り専用 sandbox、一時フォルダ）で呼び、Codex CLI が無ければ 503 で止める。
  別のモデルへ黙って切り替えない（自動更新でも同じ。Astra が使えないときは失敗として状態に残す）。
- PF-CS-4: キャッチコピーは UX/ゴールの文言（PF-GOAL-W3）を 1 字も変えずに載せる。Pf は Astra の出力を受け取ってから、
  出力の catchcopy が文言と同じか、紙面にその文言が読める文字として載っているか（改行位置の違いだけを許す）を確かめる。
  UX/ゴールのキャッチコピーが空なら Astra の案を載せ、UX/ゴールにも「AI案」（origin=ai）として入れる。
  空で、かつ生成を始めたときの版のままの行だけを書き換え、人が生成中に書いた文言は上書きしない（そのときシートは保存しない、409）。
- PF-CS-5: 保存前に紙面を確かめる。script・on で始まる属性・javascript:・iframe/form/link/meta などの埋め込み・@import・
  属性や CSS の url() に書いた外部/data: の URL を拒む。画像は `{{IMAGE_n}}` の差し込み口で持ち、表示・出力の直前に検証済みの
  data URL を埋め、CSP（`default-src 'none'; img-src data:; style-src 'unsafe-inline'` ほか）を head に入れる
  （`shared/concept-sheet-html.ts`）。プレビューの iframe は script を許さず、印刷のダイアログだけを許す。
  画面のプレビュー・印刷・HTML 保存は同じ仕上げ済みの文字列を使う。
- PF-CS-6: 作成・削除は版一致で行い、別の人の更新を上書きしない（409）。生成中に UX/ゴール（キャッチコピー・制約を含む）が
  変わったら保存しない（409）。生成中に仕様・ビジュアルが変わったときは保存し、紙面は「古い」になる（次の自動更新で直す）。
  生成中に候補のビジュアルが（どの版も使っていなかったため）行ごと消えたら保存しない（`concept_sheet_visual_removed`、409）。
  同じプロジェクトの同時生成と、サーバ全体で 2 本を超える生成は断る（429）。人の作り直しと自動更新は同じ枠を使う。
  1 回目の出力が確認（形・字数・紙面の安全・キャッチコピー・シーン名）を通らなければ、問題を添えて 1 回だけ直させ、
  それでも通らなければ保存しない（`concept_sheet_quality_check_failed`、422）。
- PF-CS-7: 作成後に UX（プロジェクト名・キャッチコピーの文言・ターゲット・ジャーニー・詳細・企画の制約・コアドメインの価値を含む）・
  仕様の見出し/分類/状態・使っているビジュアル（名前・種類・メモ・削除）が変わったシートは「UXが更新済み」と表示し、作り直しを促す。
  キャッチコピーの origin だけの変化、仕様の本文だけの変化、一押しの付け外しでは古くしない。技術・運用の制約は材料に入れない。
  仕様を材料にする前に作った版（source に specDigest が無い）は、仕様を反映していないので古いと扱う。
- PF-CS-8: プロジェクトの「企画概要書」タブで一覧・表示・出力・作り直し・削除を行う。一覧は各シートの最新版を出す。
  上部の「企画概要書」から、見られる全プロジェクトの一覧（`/concept-sheets`）を開き、カードからそのシートを開ける
  （`/projects/:pid?tab=concept-sheets&sheet=:id`）。全プロジェクトの一覧は、生成済みの紙面（最新版）の縮小表示を
  プロジェクトをまたいで更新の新しい順に並べ、キャッチコピー・プロジェクト名・企画名・版の番号を添える（2026-09-29 neco 指示）。
  一覧 API（`GET .../concept-sheets`）は画像と紙面を含めず、縮小表示は画面に入った紙面から 1 枚ずつ取得する（`GET .../concept-sheets/:id`）。
  文面の手直しは「作り直す」に指示を添えて行う（前回の紙面を土台にする）。初版の「文面を直す」（人の直接編集）は廃止した。
- PF-CS-9: Astra の設計は数分〜十数分かかり、HTTP の 1 往復や中継の待ち時間に収まらない。生成は受け付け（202）だけを返して裏で走らせ、
  画面は `GET /generation` で状態を問い合わせる（10 秒ごと。自動更新の予約がある間も問い合わせる）。成功した生成は状態から消え、
  シートの新しい版として一覧に出る。失敗は理由のコードを状態に残す。状態には、人の作成・作り直し（manual）か自動更新（auto）かを持つ。
  状態はサーバのメモリだけに持ち、再起動で消える（人の生成はもう一度作る。自動更新は起動時に予約し直す、PF-CS-11）。
- PF-CS-10: 企画概要書ごとに版を残す。作成が rv1、作り直し・自動更新のたびに rv2, rv3…（版は全部残す）。
  詳細画面で版を切り替えて見られ、印刷・HTML 保存もその版で行う（保存名に rv を付ける）。一覧・全プロジェクトの一覧は最新版を出す。
  版は紙面・出典・使ったビジュアル（id と中身の digest、そのときの名前・種類・メモ）を持つ。画像は版ごとに複製しない
  （保存形式と、ビジュアルを消しても古い版の画像が消えない理由は [spec/schema/concept-sheets.md](../schema/concept-sheets.md)）。
  migration 021 より前からあるシートは、その行の内容（画像を含む）を rv1 として引き継ぐ（Postgres は migration、SQLite は起動時）。
  作り直しや削除の版一致（revision）は版の番号（rv）とは別に数える（引き継いだシートは revision が 2 以上でも rv1 から始まる）。
- PF-CS-11: 自動更新。UX（価値/コンセプト・ターゲット・ジャーニー・詳細）の保存、企画の制約の作成・更新・削除、仕様の作成・更新・削除、
  ビジュアルの更新・削除を受けて、そのプロジェクトを予約する。変更が続く間は待ち、最後の変更から 10 分静かになったら、
  自動更新 ON で古くなった（PF-CS-7）シートを 1 枚ずつ Astra で作り直して新しい版にする（前回の版の紙面と候補を土台にする。
  候補のビジュアルが消えていれば外し、残らなければ既定の候補、それも無ければ失敗）。1 プロジェクト 1 本・サーバ全体 2 本までで、
  人の作り直しと同時には走らせない（枠が埋まっていれば 10 分待ち直す）。失敗は理由を状態に残し、そのシートは次の変更まで作り直さない。
  自動更新はシートごとに ON/OFF でき、既定は ON（OFF は紙面の版一致に触らない。ON にしたら予約する）。
  予約はメモリだけに持ち、サーバ終了時に解除する。起動時に、自動更新 ON で古くなったシートを持つプロジェクトを予約し直す。
  画面は、予約（いつごろ走るか）・自動更新中・自動更新の失敗（理由と、次の変更で再試行すること）を出す。
  自動更新が空のキャッチコピーを埋めるときも PF-CS-4 と同じ（AI案、人の文言は上書きしない）。
- PF-CS-12: 画面の候補は、登録したビジュアル（[project-visuals.md](project-visuals.md)）から 1〜6 枚を選ぶ（選んだ順が候補の順）。
  既定は キービジュアル → 一押し → コンセプトアート の順（それぞれ新しく登録した順、PF-VIS-5）。
  作成画面で新しい画像を足すと、ビジュアルにも登録され、そのまま候補に入る。
  migration 021 より前の形のシートを「前回の候補を使う」で作り直すときは、行の中の画像をスクリーンショットとしてビジュアルへ移して
  候補にする（同じ画像が登録済みならそれを使い、二重に登録しない）。

閲覧はプロジェクトメンバー全員。作成・自動更新の ON/OFF・削除は owner / planner / designer（UX/ゴールを編集できる人）。

## API

`/api/projects/:pid/concept-sheets`

| 操作 | 内容 |
|---|---|
| `GET /` | 一覧（最新版、`limit` / `offset`）。`{canEdit, hasMore, items:[{id,title,catchcopy,concept,sceneLabel,updatedAt,freshness,rv,autoUpdate}]}` |
| `GET /generation` | 生成の状態と自動更新の予約。`{job: null \| {sheetId, trigger:'manual'\|'auto', state:'running', startedAt} \| {…, state:'failed', finishedAt, error}, autoUpdate:{scheduledAt: string \| null}}` |
| `GET /:id` | 最新版。`{sheet, versions:[{rv,kind,createdAt}], canEdit}`。sheet は `{id,projectId,revision,updatedAt,rv,latestRv,kind,createdAt,autoUpdate,design,images,visuals,source,freshness}` |
| `GET /:id/versions/:rv` | 版 rv（形は `GET /:id` と同じ）。無い版は 404 |
| `POST /generate` | `{id(uuid), expectedRevision, visualIds: string[] (1〜6) \| 'keep', instructions?}`。202 `{id, state:'running'}` |
| `PUT /:id/auto-update` | `{enabled: boolean}`。自動更新の ON/OFF |
| `DELETE /:id?expectedRevision=` | 削除（版もすべて消す） |

kind（版を作ったきっかけ）: `create`（作成）/ `regenerate`（作り直し）/ `auto`（自動更新）/ `migrated`（migration 021 で引き継いだ rv1）。

保存形式は [spec/schema/concept-sheets.md](../schema/concept-sheets.md)。

## 実装

| ファイル | 責務 |
|---|---|
| shared/concept-sheet.ts | 紙面・画面の候補・出典・版・生成の状態の型と上限、自動更新の待ち時間 |
| shared/concept-sheet-html.ts | 紙面の安全確認、読める文字の照合、画像の差し込みと CSP |
| shared/catchcopy.ts | キャッチコピーの上限と origin の決まり |
| server/src/lib/concept-sheet-input.ts | 要求の検証と画像（data URL）の確認 |
| server/src/lib/concept-sheet-sources.ts | 材料（名前・キャッチコピー・UX/ゴール・コアドメインの価値・仕様の見出し）の読み込みと digest |
| server/src/lib/concept-sheet-freshness.ts | 鮮度（UX・仕様・使っているビジュアル） |
| server/src/lib/concept-sheet-candidates.ts | 画面の候補（選んだビジュアル / 前回の版の候補 / 既定 / 前の形の画像の移し替え） |
| server/src/lib/concept-sheet-prompt.ts | Astra への依頼文（候補の種類・メモ・一押し、自動更新の文脈）と出力の形 |
| server/src/lib/concept-sheet-design-check.ts | Astra の出力の確認（形・字数・安全・キャッチコピー・シーン名） |
| server/src/lib/concept-sheet-writer.ts | Astra を呼び、確認に通らなければ 1 回だけ直させる |
| server/src/lib/astra-cli.ts | Codex CLI で Astra を 1 回呼ぶ（一時フォルダ・読み取り専用・時間切れ） |
| server/src/lib/concept-sheet-generation.ts | 1 回の生成で版を 1 つ足す（人の作成・作り直しと自動更新で共通） |
| server/src/lib/concept-sheet-jobs.ts | 裏で走る生成と、その状態（manual / auto） |
| server/src/lib/concept-sheet-auto-update.ts | 自動更新の予約（10 分の静かな時間・1 枚ずつ・失敗は次の変更まで飛ばす・停止・起動時の予約し直し） |
| server/src/lib/concept-sheet-auto-targets.ts | 自動更新の対象（自動更新 ON で古いシート） |
| server/src/lib/concept-sheet-records.ts | 版を画面・出力の形にする（版が指すビジュアルの画像を引く） |
| server/src/db/schema/concept-sheet.ts / server/src/db/concept-sheet-sqlite.ts | 表（Postgres / SQLite）。SQLite の列の追加と rv1 の写し |
| server/migrations/021_concept_sheet_versions_and_visuals.sql | Postgres の表・列の追加と rv1 の写し |
| server/src/db/sqlite-schema.ts / server/src/db/connection.ts | SQLite の起動時の DDL・列の追加・写し（SQLITE_BACKFILLS）の登録と実行 |
| server/src/db/concept-sheet-persistence.ts | 版一致の作成・次の版・削除、自動更新の ON/OFF |
| server/src/db/concept-sheet-reads.ts | シート・版の読み取り |
| server/src/db/dual-dialect.ts | SQLite / Postgres の両方で文を 1 つのトランザクションとして流す |
| server/src/db/project-catchcopy-persistence.ts | 空のキャッチコピーを AI案 で埋める（空で版一致の行だけ） |
| server/src/routes/concept-sheets.ts | 権限・競合・生成の受け付け・版・自動更新の ON/OFF |
| server/src/index.ts | 自動更新の配線（UX・制約・仕様・ビジュアルの routes から知らせる、起動時の予約し直し、終了時の解除） |
| server/src/routes/project-ux-goal.ts / server/src/routes/project-constraints.ts / server/src/routes/specs.ts | 保存・作成・更新・削除を自動更新へ知らせる（MaterialChangeListener） |
| web/src/lib/concept-sheets-api.ts | 呼び出しと失敗の言い換え |
| web/src/components/concept-sheets/ConceptSheetWorkspace.tsx | タブ（一覧・状態の待ち受け・作り直し・削除・版と自動更新の配置） |
| web/src/components/concept-sheets/ConceptSheetGenerator.tsx | 作成・作り直し（前回の候補を使う / ビジュアルから選ぶ・指示） |
| web/src/components/concept-sheets/ConceptSheetCandidatePicker.tsx | 候補をビジュアルから選ぶ・新しい画像を足す |
| web/src/components/concept-sheets/ConceptSheetStatus.tsx | 生成・自動更新の状態と予約の表示 |
| web/src/components/concept-sheets/ConceptSheetVersionBar.tsx | 版の切り替えと自動更新の ON/OFF |
| web/src/components/concept-sheets/ConceptSheetPreview.tsx | 表示中の版のプレビューと出力（印刷・HTML 保存） |
| web/src/pages/ConceptSheetsIndexPage.tsx | 全プロジェクトの一覧（最新版） |

## 検証

`server/src/lib/__tests__/concept-sheet.test.ts`（キャッチコピーの origin、紙面の安全確認と差し込み、読める文字の照合、
画面の候補の種類・中身・大きさ、Astra 出力の確認と 1 回の直し、依頼文の候補と仕様と自動更新、生成の状態と manual / auto、
UX/ゴールの文言の採用・空欄の AI案・人の文言を上書きしない・版 rv1 / rv2 と版の取得・版の競合・権限・鮮度・削除）、
`concept-sheet-versions.test.ts`（既存の行を rv1 として 1 回だけ写す・前の形の画像をビジュアルへ移す・消したビジュアルの画像が古い版に残る・
使っているビジュアルの変更で古くなる・仕様は見出し/分類/状態だけで 100 件まで・自動更新の ON/OFF と対象）、
`concept-sheet-auto-update.test.ts`（10 分の静かな時間・1 枚ずつ・人の作り直しと同時に走らない・失敗は次の変更まで飛ばす・停止・
UX/制約の保存で知らせる）。題材は架空の企画にする（公開リポのため）。
単体・動作テストと、実際の Astra 生成・印刷の確認は明示の許可があるときに行う。型チェックは server / web の既存コマンド。
反映には本体での build と Excubitor 経由の再起動が要る（SQLite は起動時に表・列を足して rv1 を写す、Postgres は migration 021）。
旧コードは新しい形の行（画像を持たない行）を読めないので、新しい形の行を書く前に旧サーバを入れ替える。
Astra の実行には、サーバを動かす利用者の Codex CLI のログインが要る（切れている間の自動更新は失敗として状態に残り、次の変更で再試行する）。
