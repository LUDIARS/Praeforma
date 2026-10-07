# Pf の資料・相談の権限境界

Actio: `actio:526a7153-a690-457c-84fe-4acfe3f2cf51`。対象は P1〜P3 のみ。

## 確定設計

- P1: 管理者の `CONFLUENCE_ORIGIN` を HTTPS の origin として検証する。資料 URL も同じ origin、userinfo なしに限定する。送信 URL は設定 origin と検証済みページ番号から組み立て、redirect はすべて拒否する。未設定・不正設定は明示エラー。資格情報や外部応答本文をエラーへ含めない。
- P2: 資料の全ルートに認証と既存 `requireRole` を適用する。読取りは全 project role、作成・削除は既存 reference 仕様に従い owner/planner。rid 操作は projectId と id を同時に SQL 条件へ入れ、越境と不存在は同じ 404。作成・一覧の target も pid 所属を検査する。未実装の更新 API は追加しない。
- P3: AI 相談は Cc 管理 API から独立した Claude print CLI とする。bare/restricted、空の tools、全 tools deny、空の strict MCP、slash commands 無効、hooks 無効、設定ソースなし、セッション保存なしを固定する。入力は stdin の会話 JSON のみ。引数・cwd・環境変数へ利用者入力を渡さない。呼出ごとに空の一時 HOME/cwd/config を作り、Cc・DB・外部資料の資格情報やプロセス起動用環境変数を子へ渡さない。対応 CLI が必要で、未知のフラグを除去して再試行しない。
- 相談専用 OAuth は管理者が `PRAEFORMA_CONSULTATION_OAUTH_TOKEN` へ供給する。既存 CLI の認証ディレクトリや管理者の環境は流用しない。未設定なら 503。モデルと binary は既存のサーバ設定を使用する。実秘密情報の取得・設定・CLI 起動はこの変更に含めない。
- project/user ごとの会話、利用者入力の fragment 保存、CAS による並行送信拒否、再表示、resume、clear を維持する。旧 Cc binding は読み込んでも発見・inject・resume・stop しない。Pf 内に保存済みの発言は残し、次の送信で安全な会話へ移行する。旧 Cc のみが持つ応答の移行・既存 agent 停止は管理者の別操作とする。
- 実装開始の既存認可ルートは別操作として維持する。相談応答をコマンド・提案実行・委託として解釈しない。local Origin guard は維持する。

## 契約

C-5 buildConfluenceRequest(url, origin): 成功時の URL は設定 HTTPS origin 内、redirect は error、userinfo は無い。
C-6 referenceBelongsToProject(reference, projectId): reference の projectId が要求 projectId と一致するときだけ true。
C-7 buildConsultationPolicy(model, cwd, token, env): tools/MCP/hooks/設定を無効化し、分離 cwd/HOME と許可環境だけを返す。

## 検証計画

Augur plan の回帰テスト優先方針に従い、P1 の origin 偽装・redirect、P2 の非 member・別 pid/rid・別 target、P3 の悪意ある本文・環境遮断・会話継続・失敗回復・旧 binding 非再利用を対で記述する。ネットワーク・CLI は偽物、DB はメモリ内のみ。ユーザーの明示許可がないためテスト・起動・実通信は実行しない。契約集計の未観測を合格扱いしない。

CLI 制限の根拠: https://code.claude.com/docs/en/cli-reference 。この境界はモデルへ提供する能力を制限するもので、CLI バイナリ自体の侵害に対する OS sandbox の保証ではない。
