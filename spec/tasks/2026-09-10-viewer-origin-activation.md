---
task: viewer-origin-activation
project: Praeforma
kind: テスト
created: 2026-09-10
memory_links:
  - spec/plan/problem_logs/2026-09-10-viewer-origin-403.md
---
# Viewer Origin許可の反映と画面確認

## 目的

Praeformaの追加許可Origin設定を稼働プロセスへ反映し、次の両URLで白画面と403が解消することを確認する。

- https://web.ai-run-do.com/viewer/?service=praeforma
- https://exiv.ai-run-do.com/viewer/?service=praeforma

## 完了条件

- 人間からPraeformaの再起動と動作確認の明示許可を得る。PR #1652への以前の許可だけを今回の許可と扱わない。
- 本体E:/Document/Ars/Praeformaの実branchとOrigin許可修正を確認する。設定の正本は所有catalog。
- Concordiaへtesting claimを行い、Excubitor経由で本体フォルダのPraeformaを再起動する。worktreeから起動しない。
- 両Origin付きのmodule script・CSS・初期APIが403にならず、両URLで実際の画面表示を確認する。
- 既存の直接公開Originを維持し、未許可Originを拒否する。変更操作を伴う確認は別途許可範囲を確認する。
- HTTP確認とブラウザ表示確認を区別して証跡を報告し、testing claimをreleaseする。

## スコープ (編集可ディレクトリ)

- 原則コード編集なし。対象サービスはPraeformaのみ。
- 不具合が残れば本体を直接編集せず、別worktreeで原因に対応する修正を行う。
- Cloudflare設定変更、Ex再起動、他サービスの追加公開は含まない。
- 進行状態や実行結果はCcのtaskflow_task_stateと確認記録へ残し、このタスク本文へ書き戻さない。
