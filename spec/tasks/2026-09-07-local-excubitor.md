# Pf を認証なしのローカルツールとして起動する

- 人間の指定: Anatomia と同様に、認証なしで手軽に利用する。
- Excubitor のサービス所有 catalog に praeforma を定義する。
- 既存の起動セットを保持して praeforma を追加する。
- 本体フォルダの既存 SQLite を利用し、ローカルモードを loopback で起動する。
- 起動確認のみ実施する。単体・統合テストは依頼されていない。
- 起動のため本体へ反映した設定・コードは、この変更と同一内容とする。

## 実施結果

- Ex の既存 selection と auto_launch を維持して praeforma を追加した。
- Concordia claim 後、Ex local-control から本体をビルド・起動した。
- `/api/health`: `localMode: true`, `db: sqlite`, `db_error: null`。
- `/` と認証ヘッダーなしの `/api/projects`: HTTP 200。
- HTTP リスナーは `127.0.0.1:8889`。確認後 testing claim を解放した。
- 単体・統合テストは実行していない。
