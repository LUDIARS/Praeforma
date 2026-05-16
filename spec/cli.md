# cli — `praeforma` CLI 仕様

ヘッドレス操作 (= CI / バッチ / Excubitor 連携) を可能にする CLI。 ステータス
**未起稿** (= backlog S4)。

## 想定コマンド (draft)

```
praeforma login                                   # Cernere composite login (browser open)
praeforma projects list
praeforma project create <name>
praeforma project export <id> --out ./snapshot/   # YAML/JSON snapshot 出力
praeforma project import ./snapshot/              # snapshot から DB 復元
praeforma acceptance run <project> <layout>       # 1 回テスト実行 + 結果出力
praeforma export unity <project> --out ./Unity/Assets/_Praeforma/
                                                  # Unity Editor 拡張なしで scene 生成
praeforma validate <project>                      # spec / domain / object の整合性検証
```

## 用途

- CI で 「commit ごとに acceptance 全部 pass か」 を回す
- snapshot を git に push (= レビュー単位を git PR で扱える)
- Excubitor の cron で深夜 acceptance 自動実行

## 実装メモ

- TypeScript + commander.js or yargs
- backend に対する API クライアント (= REST + WS)
- Cernere token は OS keychain (Cernere CLI 風) に保存

## 関連
- §4 データモデル (export snapshot 形式)
- §11 acceptance test (CLI run trigger)
