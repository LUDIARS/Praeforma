# 仕様確認 (プロジェクトの基本 4 画面のひとつ)

基本画面の全体構成は project-dashboard.md を正とする。

## 目的

2026-11-19 neco 指示:

> PfのUIがごちゃってるので、基本画面を「現在の体系仕様と断片仕様の確認」にフォーカスします。

基本画面のひとつとして、いまの体系仕様 (ストラクチャード) と断片仕様 (フラグメント) を
見比べて確認する画面にする。登録・整理・スプリント・再構築・説明書・可視化は従来どおり「仕様」タブで行う。

## 要件

| ID | 内容 |
| --- | --- |
| PF-HOME-1 | 仕様確認 (`spec-review`) は基本 4 画面の 2 番目。既定タブはダッシュボード (PF-DASH-1)。従来の「概要」は「その他」に残す。 |
| PF-HOME-2〜4 | (2026-11-19 廃止。PF-HOME-8〜12 で置き換え。旧: 体系と断片を左右 2 列に並べ、断片は全件を 1 本のリストで出す) |
| PF-HOME-5 | 各タブの「編集する」「登録・編集する」は「仕様」タブの体系 / 断片へ移る (`tab=specs&spec_kind=structured|fragment`)。 |
| PF-HOME-6 | `?tab=spec-review&focus=<code>` は該当の体系仕様を開いてスクロールする (既存の focus 契約と同じ)。 |
| PF-HOME-8 | (2026-11-19 改訂、PF-HOME-2〜4 を置き換え) 仕様確認は「体系」「断片」「保留中」の 3 タブに分ける。既定は「体系」。保留中の断片が 1 件以上あれば、保留中タブに件数バッジを出して目立たせる。 |
| PF-HOME-9 | 体系タブはカテゴリ (振る舞い / 見た目 / データ / 操作 / その他) ごとに、いまの版の体系仕様を出す。各仕様の中身は既存の体系仕様一覧と同じ表示。廃止 (obsolete) した仕様はカテゴリごとの閉じたトグルに入れる。 |
| PF-HOME-10 | 断片タブは断片を新しい順のリストで出す。体系化で採用 (統合済) された断片と却下 (棄却) された断片は、それぞれ別の閉じたトグルに入れる。トグルの見出しに件数を出す。 |
| PF-HOME-11 | 保留中タブは、まだ体系化で処理されていない断片を開いた状態で新しい順に出す。読み取り専用。 |
| PF-HOME-12 | 断片の一覧 API は `disposition=pending|integrated|rejected` で絞り込める。件数は `GET /spec-fragments/counts` → `{ pending, integrated, rejected }`。絞り込みは処理結果 (spec_reconstruction_fragments) で判定し、ページ送りの前にかける。 |
| PF-HOME-7 | プロジェクトの見出しは名前と説明だけにする。シナリオはタブ、ScreenFlow は「その他」メニューから開く。プロジェクト ID / platforms は「概要」タブに移す。 |

## 検証

- `server/src/lib/__tests__/spec-fragments-filter.test.ts` — 絞り込み・ページ送り・件数・不正な指定。
- `web/checks/project-home.test.mjs` — 3 タブ・件数バッジ・カテゴリ・廃止のトグルが出ること。

## 表示しないもの

- 再構築・バージョンログ、スプリント、説明書、可視化 (いずれも「仕様」タブ)。
- 断片の実装状態の更新・整理状態の変更 (「仕様」タブの断片で行う)。

## 実装

- `web/src/components/specs/SpecReviewHome.tsx` — 体系 / 断片 / 保留中の 3 タブ (PF-HOME-8)。
- `web/src/components/specs/CategorizedSpecList.tsx` — カテゴリごとのいまの版と、廃止した仕様のトグル (PF-HOME-9)。
- `web/src/components/specs/ProcessedFragmentToggles.tsx` — 採用 / 却下の閉じたトグル。開いたときに読む (PF-HOME-10)。
- `web/src/components/specs/FragmentList.tsx` — `readOnly` で登録フォームと編集操作を隠す。`disposition` で絞り、`openCards` で開いた状態にする。
- `server/src/lib/fragment-filter.ts` / `fragment-disposition-param.ts` — 処理結果での絞り込みと件数 (PF-HOME-12)。
- `web/src/components/ProjectTabs.tsx` — 基本 4 画面の 2 番目に「仕様確認」。従来の「仕様」は「仕様の編集」として「その他」へ。ScreenFlow も「その他」へ。
- `web/src/pages/ProjectShowPage.tsx` — 見出しの簡素化、仕様確認タブの描画と focus 対応。

## 表示仕様

状態バッジには状態名を残す。保留中タブは件数バッジ (色と数字) で目立たせ、断片タブにも保留中の件数と移動先を出す。

関連タスク `actio:f2751125-8483-4cc1-82c7-cbb02e2ed9b4`
