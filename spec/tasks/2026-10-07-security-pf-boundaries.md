# Pf P1〜P3 実装

- Actio: `actio:526a7153-a690-457c-84fe-4acfe3f2cf51`
- 設計: [security-pf-boundaries](../feature/security-pf-boundaries.md)
- 指定 worktree / branch を再利用。main 更新・push・merge・起動なし。

1. 契約 C-5〜C-7 と述語、Augur テスト計画を先行追加。
2. Confluence の固定 origin と redirect 禁止を実装。
3. 資料の membership / reference / target 所属を共通検査。
4. 相談を権限なしの独立 runner へ変更し、会話保存と通常操作を維持。
5. 偽資格情報・偽 runner の回帰テストを追加。実行は許可待ち。
6. Concordia コミット、Revisor local PR、実際の証跡と残件を報告。

## 実装内容

Confluence は管理者指定 HTTPS origin と資料 origin の一致を検査し、資格情報付き redirect を拒否する。資料の一覧・作成・削除・content は membership を検査し、rid 操作を pid と同時に絞る。target 所属も検査する。

AI 相談は Cc の管理用 spawn/inject/resume/stop から切り離した。固定の tool-less CLI policy、一時 HOME、許可環境変数、専用 OAuth を使う。会話・fragment 保存、並行送信拒否、復帰・clear は維持する。既存の実装開始ルート・local Origin guard は変更しない。

## 再利用の採否

- `requireRole`、`versionRows`、会話 CAS ストア、fragment ストアを再利用した。既存の認証と保存方式を維持するため。
- Lapilli one-shot を再利用した。Windows executable 解決と shell=false の共通境界を維持するため。
- `runRestrictedWriter` はそのまま採用しない。既存版は repository cwd と親の環境を渡すため、相談専用の HOME・環境分離を満たさない。既存の仕様生成経路へ影響させず専用 runner を設けた。
- 契約ランタイムは既存の固定済み `lib/lapilli` submodule の log-weaver を依存へ追加した。別 repo の実装や submodule commit は変更していない。

## 受け入れ条件

C-5 buildConfluenceRequest(url, origin): 成功時の URL は設定 HTTPS origin 内、redirect は error、userinfo は無い。
C-6 referenceBelongsToProject(reference, projectId): reference の projectId が要求 projectId と一致するときだけ true。
C-7 buildConsultationPolicy(model, cwd, token, env): tools/MCP/hooks/設定を無効化し、分離 cwd/HOME と許可環境だけを返す。

## 検証と残件

- server / web の TypeScript 型検査は成功。Augur 契約 lint は findings 0、変更対象の contract-wrap strict check は 3 件すべて applied。`git diff --check` は成功。
- 回帰テストは追加したが、ユーザーのテスト実行禁止に従い未実行。Augur 集計は C-5〜C-7 が not-called / met=false。既存 C-1〜C-4 も今回未観測。合格や受入完了とは報告しない。
- `DELEGATION_STARTED_AT` が未設定だったため、集計窓の開始には Cc の当該 run の created_at を使った。
- 設定適用前に `CONFLUENCE_ORIGIN`、相談専用 `PRAEFORMA_CONSULTATION_OAUTH_TOKEN`、bare/restricted 対応 CLI を管理者が用意する必要がある。実秘密情報の有無・値は確認していない。
- 旧 Cc セッション側だけにある応答の移行と既存 agent の停止は未実施。新経路から旧 agent を操作しない。
- サービス起動・再起動、実 LLM 起動、外部資格情報付き通信、merge・push・反映は実施していない。Revisor の設定や既定 OFF は変更しない。
