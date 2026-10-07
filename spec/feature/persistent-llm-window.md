# Pf内の永続AI相談ウインドウ

- PF-CHAT-1: プロジェクト画面のヘッダ横「AI相談」からPC・スマホ共通で開閉する。Pf内で最前面に表示する。畳む操作はいつでも可能で、会話の終了やClearを意味しない。
- PF-CHAT-2: 送信時に tool-less の Claude print CLI を一回実行する。開くだけでは実行しない。ユーザー・プロジェクト単位の会話を DB に保存する。owner/planner が利用可能。実行境界は [P3](security-pf-boundaries.md) に従い、Cc の管理 API は使用しない。
- PF-CHAT-3: 30分やり取りが無ければブラウザの取得を止める。会話は DB に保持する。再接続では同じ履歴を表示し、次の送信に引き継ぐ。失敗した送信は自動再実行しない。
- PF-CHAT-4: 明示 Clear で Pf の会話をリセットする。仕様フラグメントは削除しない。実行中は Clear を拒否する。旧 Cc プロセスを操作する権限は持たない。
- PF-CHAT-5: 送信内容を仕様フラグメントにも保存する。CAS で同時送信を防ぐ。失敗・処理中断時は uncertain として入力を保持し、明示 resume で会話を再開可能にする。旧 Cc binding を再利用しない。
- PF-CHAT-6: CLI バイナリ・モデルはサーバ設定、認証は相談専用 `PRAEFORMA_CONSULTATION_OAUTH_TOKEN` を使う。未設定は明示 503。書込み・コマンド・MCP を相談本文から許可する経路は無い。実装開始は別の認可された操作とする。

表示は Pf に保存した利用者入力と応答。旧 Cc のみが保持する応答は自動で取得しない。旧履歴移行・agent 停止は管理者の別操作。OS全体の最前面表示ではなくPf内の表示。

検証計画: `server/src/lib/__tests__/llm-chat.test.ts`（送信競合・永続化・ユーザー分離・履歴継続・失敗回復・旧 binding 非再利用・Clear・フラグメント保存）、`consultation-policy.test.ts`（能力・環境分離）。画面・実 CLI 検証は別途実行許可後に行う。
