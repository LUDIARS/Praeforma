# Pf の Cloudflare Tunnel 設定が資格情報取得で止まる

## 発生条件と観測

Pfを他サービスと同じloopback + Cloudflare Tunnelで提供するため、Exの
`GET /api/v1/cf-tunnel/routes` を呼ぶと、`cf_tunnel_list_failed` と
`Infisical login failed: 502` が返る。時間を置いた再取得でも同じ結果だった。

ExのCF設定参照APIは応答する。Tunnel変更のhostname allowlistには
`qs-magiclink.ai-run-do.com` のみが登録されており、Pfの公開ルートはまだ確認できていない。

## 影響と実施範囲

- Tunnel一覧・既存のルート設定を確認できず、Pfのingress・DNS・アクセス制御の適用は未実施。
- Pfはloopbackへ戻し、LAN受信ルールは追加していない。
- `https://pf.ai-run-do.com` はPf側に設定した公開Origin候補であり、開通確認済みURLではない。
- Exの画面リンクは開通までloopbackを維持する。
- セッションへCFトークンを取り出す回避策は使用しない。

## 次の対応

Exが利用するInfisicalのログイン経路を復旧し、既存Tunnelを読み取る。
他サービスの命名・アクセス制御・DNSに合わせてPfの公開先を確定し、必要なhostnameだけを
allowlistへ追加してPfのloopbackへのルートを作成する。公開URLの動作を確認してから
Exの画面リンクを更新する。
