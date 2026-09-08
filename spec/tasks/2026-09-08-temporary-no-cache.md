# Pf UI調整期間のキャッシュ無効化

necoの「しばらくキャッシュ殺す運用」指示により、HTTP応答（HTML・JS/CSS・API・エラー）に `Cache-Control: no-store, max-age=0` を付与する。CDN向けにも no-store を明示する。

ブラウザのAPI fetchは `cache: no-store`。React Queryは `staleTime: 0` / `gcTime: 0` とし、再訪時の再取得を省略せず、未使用の取得結果を保持しない。認証tokenやユーザ入力の保存は削除しない。

PfはService Workerを登録していない。Viteのhash付きJS/CSSと通常のページ再読込で新しいコードを取得する。既に開いている画面は反映後に一度再読込する。

運用解除はユーザから指示された時に別変更として行い、期限による自動再有効化はしない。noStoreResponses の登録、API fetch のcache設定、QueryClient既定値を合わせて戻す。

検証: server/webの型チェック、HTTP応答headerの回帰テスト（Revisor）、main取り込み後のビルド・Ex再起動・HTML/API/JS/CSS配信header確認。
