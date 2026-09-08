# 機能説明書の保存契約

`feature_manuals` はプロジェクト所属の説明書を保持する。ID は UUID、project_id は対象プロジェクト、revision は1始まりの比較更新用整数、updated_at は更新時点。payload は次の文書である。

- document: 人間が確認・保存した説明書。初回生成時は null。
- proposal: 最後に生成した案。保存済み本文とは別に保持する。
- source: 生成時の仕様ID・内容のSHA-256、実装資料の参照先・版・本文・SHA-256、専用スキルのSHA-256。
- publishedSource: 保存済み本文の元資料。初回生成時は null。

説明書はタイトル、目的、見出し付き本文、段階と分岐を含む図からなる。任意HTML・SVG・スクリプト・Markdownは保存形式に含めず、画面側が文字列として表示する。

生成は対象プロジェクトの既存仕様をサーバーで取得し、執筆者が選んだ実装資料（最大80,000文字）と版を渡す。実装資料を本体リポジトリから自動取得する契約ではない。生成元の実装の更新確認は資料の再読み込みが必要であり、画面にも明示する。仕様の本文・版・削除とスキルの変更は参照時に検出する。

POST /api/projects/:pid/manuals/generate は id / expectedRevision / specId / implementation を受ける。初回INSERTの競合と再生成中の同時更新を比較更新で拒否し、既存本文を保持したまま生成案だけを更新する。生成失敗は保存しない。

PUT /api/projects/:pid/manuals/:id は expectedRevision / basis(saved|proposal) / document を受ける。採用元の根拠はサーバーが取得し、クライアントから根拠や版を任意に書き換えさせない。生成後に仕様が変わった場合は保存を拒否する。

GET 一覧・詳細はプロジェクト権限を検査する。閲覧者には保存済み本文と更新要否だけを返し、未保存の案・実装資料は返さない。作成・更新は owner / planner / designer / programmer / reviewer に限定する。

PostgreSQLと明示local modeのSQLiteで同じ比較更新契約を用いる。マスターデータ・本番実装には書き込まない。
