# LLM モデル役割

関連タスク: `actio:aa24239f-5f88-48a6-b1ba-a0cb589cdb1e`

- Praeforma は既定のモデル ID を保持せず、Lapilli one-shot の Concordia 役割マップ解決を使う。マップの場所は `LUDIARS_MODEL_ROLES_FILE` で指定できる。
- Claude CLI の既定は `sonnet`。`PRAEFORMA_CLAUDE_MODEL` で Claude の役割またはモデル ID を明示指定できる。明示されたモデル ID は役割マップで置き換えない。
- コンセプトシートの Codex CLI は `astra` を使う。再試行も実行ごとに解決し、対応するモデルが解決できない場合は別モデルに切り替えない。
