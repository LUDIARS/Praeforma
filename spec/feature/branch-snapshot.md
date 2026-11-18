# 各ブランチに置く設計データの写し

## 目的

2026-11-19 neco 指示:

> Pfのデータ保存はPostgressを正本としますが、リポジトリ内にクローンデータを持ちます。
> これは体系データを今のブランチ情報と合わせて整合を取るためです(Pfは常に最新で管理されるので各ブランチやステップの差分を理解するにはブランチの状態を理解する必要がある)
>
> (写しの置き方の選択) 各ブランチの中に置く
>
> pf-dataは廃止して、基本データ構造はその前の設計に戻す

Pf の DB は常に最新を持つ。各コードブランチには、そのブランチを作業した時点の写しを `.praeforma/` に置く。
ブランチ同士・段階同士の違いは、写しを git で比べれば分かる。Pf はブランチの写しと最新との違いを一覧で示す。

DB の正本を Postgres にする切り替えは別の変更で扱う。

## pf-data の廃止 (2026-11-19)

`pf-data` ブランチへの保存・送信・取り込み (`/api/projects/:pid/repo-data/*`、旧 spec/feature/repo-data-branch.md) を削除した。
既存リポジトリに残る `pf-data` ブランチは Pf から読まず、書かない。消すかどうかは各リポジトリの判断に任せる。
`projects.repo_data_dir` (migration 028) は列を消せない規則のため残し、写しを読むリポジトリのフォルダ名として使う。

## 写しの形

基本のデータ構造は pf-data 以前の設計 (書き出しモデル `server/src/lib/export/model.ts`、feature/screen-flow.md §7) に戻す。

```
.praeforma/manifest.json   形式 (format=1)・プロジェクト名・仕様の版 (specVersion)・生成したファイルの一覧
.praeforma/model.json      書き出しモデル (画面・UI 要素・要件・遷移・ドメイン・Cc 接続)。キー順と行順を固定した JSON
.praeforma/spec.md         仕様書 (Markdown)。GET /export/spec.md と同じ生成器
.praeforma/flow.mmd        遷移図 (Mermaid)。GET /export/flow.mmd と同じ生成器
```

- 同じデータからは同じバイト列を作る (差分が意味のある変更だけになる)。
- 利用者を特定する項目 (`*By`, `*UserId`, `*DisplayName`) は書かない。
- `.praeforma/` に人が置いたファイル (manifest に無いもの) は消さず、比較もしない。

## 動き

| ID | 内容 |
| --- | --- |
| PF-SNAP-1 | `GET /api/projects/:pid/branch-snapshot` は最新の写し一式 `{ files: [{ path, content }] }` を返す。全ロール、読み取りのみ。 |
| PF-SNAP-2 | 写しは作業中のセッションが `node <Praeforma>/server/scripts/pf-snapshot.ts --project <pid> --url <Pf の URL> [--dir <作業ツリー>]` で書き出す。`.praeforma/` の外には書かない。前回の manifest にあって今回生成しないファイルだけ消す。commit はしない。 |
| PF-SNAP-3 | 写しはコードと同じ変更単位で commit し、Revisor の審査を通す。Pf はブランチ・ref・作業ツリーを変更しない。 |
| PF-SNAP-4 | `GET /api/projects/:pid/branch-snapshot/branches` はローカルブランチを新しい順に最大 50 件読み、各ブランチ先頭の `.praeforma/` を最新と比べる。状態は 写しなし / 写しが読めない / 一致 / 違う、ファイルごとに 一致 / 内容が違う / ブランチに無い / ブランチにだけある。 |
| PF-SNAP-5 | 読むリポジトリはリポジトリ置き場の一覧にあるフォルダだけ。未設定ならプロジェクト名で探し、無ければ 409 `repo_dir_not_found`。`PUT /branch-snapshot/binding` (owner) でフォルダ名を設定する。 |
| PF-SNAP-6 | 画面はプロジェクトの「UX」タブ (その他) にブランチの一覧と状態を出す。 |

## 実装

- `server/src/lib/branch-snapshot/snapshot-manifest.ts` — 置き場所・manifest・書き出し計画 (依存なし。CLI からも読む)
- `server/src/lib/branch-snapshot/snapshot-files.ts` — 書き出しモデルから写しを作る
- `server/src/lib/branch-snapshot/compare.ts` — 最新とブランチの比較
- `server/src/lib/branch-snapshot/snapshot-git.ts` — ブランチ一覧と写しの読み取り (git の読み取りコマンドのみ)
- `server/src/routes/branch-snapshot.ts`、`server/scripts/pf-snapshot.ts`、`web/src/components/BranchSnapshotPanel.tsx`

## 検証

`server/src/lib/__tests__/branch-snapshot.test.ts`。

## まだ含めないもの

| 項目 | 状態 |
|---|---|
| 写しから DB への取り込み | DB が正本のため持たない。必要になったら安定 ID の照合として別途設計する |
| 断片・UX・シナリオの写し | 体系データ (書き出しモデル) に限る。広げる場合は形式 (format) を上げる |
| ブランチ先頭以外 (任意のコミット・段階) との比較 | 一覧はブランチ先頭のみ。段階ごとの差分は git で写しを比べる |
