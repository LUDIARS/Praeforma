# LLMウインドウの会話初期取得が500になる

- Date: 2026-09-08
- Area: server/src/db/llm-chat-store.ts

## Evidence
#1572をマージして本体を反映後、GET /api/projects/:pid/llm-chat が500。ログは `TypeError: This statement does not return data. Use run() instead`。readChatからversionRowsを呼ぶ経路で発生した。

## Cause
Revisor自動修正23868b6で初期INSERTからRETURNINGが除去されたが、versionRowsはSQLiteでall()を使うため実行できなくなった。初期実装後の退行。

## Fix
戻り値のない初期INSERTをversionBatch（SQLite run / PostgreSQL query）で実行し、後続SELECTで保存内容を読む。

## Verification
既存llm-chat.test.tsの初回viewと再読込がこの退行を検出する。マージ後、本体APIでstate=empty、messages=[]が返ることを確認する。
