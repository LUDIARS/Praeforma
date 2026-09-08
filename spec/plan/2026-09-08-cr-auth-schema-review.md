# Cernere 認証・データスキーマの静的レビュー

2026-09-08。Cernere ローカル main `534e56b` を基準とする。以下の参照は Cernere リポジトリ内のパス。テスト・脆弱性の実行検証・Cr の DB 接続は行っておらず、稼働環境の到達性や実際の被害は未確認。今回の Pf UI 実装では、下記の Cr 側問題は修正していない。

## 優先して対応する指摘

### CR-01 / P1: MFA チャレンジで通常の WS セッションが成立する

`server/src/ws/guest.ts:101` はパスワード照合後に MFA token を返す。`server/src/auth/jwt.ts:104` では通常 access token と同じ鍵・sub・role を用い、用途を区別しない。`:112` の検証器も用途を検査しないため、`server/src/ws/auth.ts:21`、`server/src/app.ts:299`、`server/src/ws/handler.ts:64` の通常セッション作成経路へ渡せる。

MFA 有効アカウントのパスワードを知る呼び出し元が、追加認証を完了せず通常ログインへ進めるコード経路がある。MFA を一回限りのチャレンジに分離し、各トークンの用途と必須 claims を検証する必要がある。

### CR-02 / P1: スキーマ既定値が SQL 式として組み込まれる

`server/src/project/schema.ts:31` の default_value は任意文字列。`server/src/project/schema-migrator.ts:109` は boolean / integer / bigint をそのまま SQL にし、json の単一引用符もエスケープしない。`:59`、`:77` 等の sql.unsafe へ到達する。`server/src/ws/project-dispatch.ts:153` の認証済みサービスの update_schema が入口になる。

サービス credential を持つ呼び出し元から SQL 式を持ち込める。正当な JSON のアポストロフィでも DDL が壊れ得る。実 DB 権限での影響範囲や複文実行の可否は未検証。default を型付きの値として検査し、対応する SQL リテラルへ安全に符号化する必要がある。

### CR-03 / P1: 共通プロフィールの操作にサービス別認可がない

`server/src/ws/project-dispatch.ts:44` の profile.get / profile.update は payload の userId を渡し、認証済み projectKey を認可関数へ渡さない。`:319` は email / 表示名 / bio 等を返し、privacy をフィールド除外に使用しない。`:348` は任意 userId のプロフィールを更新でき、一部 opt-out 以外の grant 検査がない。

有効なサービス credential と対象 UUID を持つ呼び出し元が、委託範囲を越えて共通プロフィールを読める・更新できる。サービス別・操作別・項目別の認可を導入し、本人操作と代理変更を区別する必要がある。

## スキーマの整合性

### CR-04 / P2: 宣言と実 DB の型・null 制約が一致しない

`server/src/project/schema-migrator.ts:47` は新規 CREATE で NOT NULL を付けるが、`:77` の ADD COLUMN では付けない。既存列の型変更も行わない。一方 `server/src/project/service.ts:400`、`:426` は新しい宣言を保存する。型を integer から text へ変えると、宣言だけが変わり得る。現行との差分を検査し、未対応の型・制約変更を明示拒否する必要がある。

### CR-05 / P2: DDL・定義・履歴の更新が一つの適用単位になっていない

`server/src/project/service.ts:263` は登録後に DDL と履歴追加、`:382` は読み取り・別接続の DDL・定義更新・履歴追加の順に実行する。`:438` の版は最新値 + 1 で、比較更新や一貫した transaction がない。途中失敗や起動時同期との競合で未完成の登録・更新消失・履歴の競合が起こり得る。プロジェクト単位の直列化と expectedRevision を導入する必要がある。

### CR-06 / P2: DB エラーを全項目 null の成功に変える

`server/src/project/service.ts:902` の getUserColumns は DB 例外を捕捉し、全列 null を返す。未登録と障害を利用側が区別できない。DB 障害・設定不備は明示エラーにする必要がある。

## UI への反映

設計編集は Praeforma、実装との対応確認は Anatomia、実際の保存領域と認可は Cernere が担当する。neco により「Cr の保存領域」はデータごとの論理的な保存先と確定した。

Pf に共通プロフィール参照と project key / module / column の対応付けを実装した。Cr のプロジェクト領域は 1 ユーザー 1 行で、module は分類と opt-out の単位であり別テーブルではない。設計情報だけを Pf に保存し、今回の UI から Cr の update_schema やプロフィール操作を実行しない。

Pf 側では認証・プロジェクト所属・編集ロールを検査し、版による比較更新、取得失敗の明示、競合時の入力保持を実装した。これらは Cr 側の指摘を解消するものではない。Cr への適用機能を追加する前に CR-01〜06 と適用権限・互換性・監査を扱う。
