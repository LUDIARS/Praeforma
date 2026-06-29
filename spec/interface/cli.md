# cli — `praeforma` CLI 仕様

ヘッドレス操作 (= CI / バッチ / Excubitor 連携) を可能にする CLI。

## ステータス

**設計済 / 実装は v0.2** (= 旧 backlog S4)。 全コマンドが REST + WS を叩く
だけなので、 Step 2 完了の現時点で実装着手可能。 ただし利用シーンが
「CI で acceptance」 「Excubitor 経由の定期実行」 等であり、 これらは
acceptance runner と Excubitor catalog が成熟してからのほうが手戻りが少ない。

## 想定コマンド

```
praeforma login                                   # Cernere composite login (browser open + token を OS keychain)
praeforma whoami                                  # /api/auth/me を叩いて role 表示
praeforma projects list                           # /api/projects
praeforma project create <name> --org <org_id>    # POST /api/projects
praeforma project show <id>
praeforma project export <id> --out ./snapshot/   # YAML/JSON snapshot 出力
praeforma project import ./snapshot/              # snapshot から DB 復元
praeforma domain list <project>
praeforma object list <project>
praeforma layout list <project>
praeforma layout open <project> <layout>          # placements を YAML で stdout
praeforma spec list <project>
praeforma acceptance run <project> <layout> --platform web|unity
                                                  # 1 回テスト実行 + 結果集計を stdout
                                                  # exit code: passed=0 / failed=1 / error=2
praeforma assets ls <project>
praeforma assets upload <project> <file> --kind image|model-3d
praeforma feedback list <project> [--layout <id>]
praeforma feedback create <project> <title> [--world x,y,z]
praeforma reference list <project> --target domain:<id>
praeforma reference fetch <project> <ref_id>      # markdown を stdout
praeforma export unity <project> --out ./Unity/Assets/_Praeforma/
                                                  # Unity Editor 拡張なしで scene 生成
praeforma validate <project>                      # spec / domain / object の整合性検証
praeforma watch <project>                         # /ws/edit に接続して edit_ops を tail
```

## 用途

- **CI**: commit ごとに `praeforma acceptance run` を回し、 失敗で exit ≠ 0
- **snapshot 管理**: export / import で git に push (= レビュー単位を git PR で扱える)
- **Excubitor cron**: 深夜 `praeforma acceptance run` を自動実行 + Slack 通知
- **dev loop**: 手元で `praeforma watch` を tail しながら他人の編集を観察

## 実装方針

- TypeScript + commander.js or yargs (LUDIARS 既存パターン)
- backend に対する `web/src/lib/api.ts` を packages/cli-api に切り出して共有
- token は OS keychain (Cernere CLI 風) に保存、 fallback で `~/.praeforma/token`
- 全コマンドは JSON 出力 mode (= `--json`) を持つ (= jq でパイプ可)
- exit code 規約:
  - 0: 成功
  - 1: 期待された失敗 (acceptance fail / spec validation error 等)
  - 2: システムエラー (network / auth / DB unreachable)

## 関連

- §4 データモデル (export snapshot 形式)
- §11 acceptance test (CLI run trigger)
- `spec/api/README.md` — 全 REST endpoint を CLI が呼ぶ
