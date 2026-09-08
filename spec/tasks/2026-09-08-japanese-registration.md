# Pf 日本語メニューと登録・階層一覧

neco指示: 日本語4＋その他メニュー、ドメイン操作メニュー、コア／ビジネスの分離、説明付き展開ボックス、アクター／シーン／ドメイン必須の仕様登録、完了後の稼働反映。

仕様: [project-registration](../feature/project-registration.md)。Telaからの登録・コメント・修正はTela完成後の接続要件として同仕様に記録する。

検証: server/web型チェック・差分チェックを行う。登録APIのSQLite回帰テストを追加し、単体・統合検証はRevisorへ提出する。本体へ取り込み後、WebをビルドしCcのclaim下でExcubitorから再起動、HTTP配信確認を行う。
