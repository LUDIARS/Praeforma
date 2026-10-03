# 単発推論の起動境界

要件提案、制限付き文章生成、画像入力、企画概要書の単発 CLI 起動は @ludiars/one-shot を通す。lib/lapilli をコミット固定した submodule として取り込み、server から file: で参照する。Node 22.12 以上と submodule update --init -- lib/lapilli 後の npm ci が必要。

Claude の役割名・未指定値は共有設定で解決する。Astra は共有 astra 役割を使用し、企画概要書の provenance と起動モデルを同じ値にする。明示的なモデル ID は維持する。継続チャットの Cc/Lictor セッションには適用しない。

共有層はモデル、Windows 実行ファイル、起動環境の整理を所有する。Praeforma は読み取り専用 sandbox、ツール・MCP 設定の制限、画像入力形式、stdin、出力検証、上限・期限、終了処理、一時ファイルを所有する。共有層は自動リトライ・権限追加をしない。制限付き writer の cwd は同じリポジトリルートを URL からファイルパスに変換して渡す。

検証は既存の企画概要書・文章生成・画像入力・継続チャットの登録テストと型確認。実 CLI の推論・サービス起動はこの移行の検証では行わない。復旧は本変更と submodule の参照を一起に revert する。
