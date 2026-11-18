# Postgres を正本にする

## 目的

2026-11-19 neco 指示:

> Pfのデータ保存はPostgressを正本としますが、リポジトリ内にクローンデータを持ちます。

リポジトリ内の写しは spec/feature/branch-snapshot.md。本書は DB 側の切り替えを扱う。

## 現状と変更

これまで個人用モード (`PRAEFORMA_LOCAL_MODE=1`、Cernere なし・固定ローカルユーザ・127.0.0.1) は保存先が必ず SQLite だった。
個人用モードのまま保存先を選べるようにし、Postgres を正本にできるようにする。

| 設定 | 認証 | 保存先 |
| --- | --- | --- |
| 通常モード | Cernere PASETO | Postgres (`PRAEFORMA_DATABASE_URL`) |
| 個人用モード + `PRAEFORMA_LOCAL_STORAGE` 未設定 / `sqlite` | 固定ローカルユーザ | SQLite (`PRAEFORMA_LOCAL_DB`) — 移行期間の既定 |
| 個人用モード + `PRAEFORMA_LOCAL_STORAGE=postgres` | 固定ローカルユーザ | Postgres (`PRAEFORMA_DATABASE_URL`) — 正本 |

## 要件

| ID | 内容 |
| --- | --- |
| PF-PG-1 | `PRAEFORMA_LOCAL_STORAGE` は `sqlite` / `postgres` (大小無視)。それ以外は起動を止める。 |
| PF-PG-2 | 個人用モードで `postgres` を選んで `PRAEFORMA_DATABASE_URL` が無いときは既定の接続先へ繋がず、`/api/health` が `db: "down"` と理由を返す。 |
| PF-PG-3 | schema の方言選択は保存先 (`SQLITE_STORAGE`) で決める。認証・Origin 検査・127.0.0.1 待ち受け・web/dist 配信は個人用モードかどうか (`LOCAL_MODE`) で決める (保存先を変えても認証は増減しない)。 |
| PF-PG-4 | SQLite サブセットに無い表を使うルート (参照・フィードバック・受入) は Postgres 保存なら個人用モードでも載せる。 |
| PF-PG-5 | `/api/health` は `storage: "sqlite" \| "postgres"` を返す。 |
| PF-PG-6 | SQLite から Postgres への写しは `npm run migrate:sqlite-to-postgres -w server -- --sqlite <file> [--apply]`。既定は下見 (行数と写せない表・列の報告のみ)。`--apply` は 1 トランザクションで `INSERT … ON CONFLICT DO NOTHING` し、既存行は変えない。SQLite にだけある表があれば拒否する。SQLite は読み取り専用で開く。表は migration の作成順 (参照先が先) に入れ、serial 列の sequence を最大値へ進める。 |

## 切り替え手順 (人の許可が要る操作)

1. Postgres の用意と `PRAEFORMA_DATABASE_URL` の登録 (資格情報の扱いは人が Excubitor / Vault で行う)。
2. `npm run migrate -w server` で migration を当てる。
3. 下見 → `--apply` で SQLite の行を写す (実データの移行。実行は人の許可を得てから)。
4. Excubitor catalog の環境に `PRAEFORMA_LOCAL_STORAGE: postgres` と接続先を足して再起動し、`/api/health` の `storage` と行数を確かめる。
5. SQLite ファイルは消さずに残す (戻すときは `PRAEFORMA_LOCAL_STORAGE` を外せば SQLite で起動する)。

## 実装

- `server/src/db/mode.ts` — `LOCAL_STORAGE` / `SQLITE_STORAGE` / `parseLocalStorage`
- `server/src/db/schema/*.ts` — 方言選択を `SQLITE_STORAGE` に変更
- `server/src/config.ts` / `server/src/index.ts` / `server/src/db/connection.ts` (`markDbUnavailable`)
- `server/src/lib/storage-migration/copy-plan.ts` / `server/scripts/sqlite-to-postgres.ts`

## 検証

`server/src/lib/__tests__/postgres-primary.test.ts`。
