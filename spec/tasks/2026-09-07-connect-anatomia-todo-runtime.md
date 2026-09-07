---
task: connect-anatomia-todo-runtime
project: Praeforma
kind: 雑用
created: 2026-09-07
memory_links:
  - spec/feature/ux-definition-todos.md
  - spec/feature/local-mode.md
---
# ドメイン整理TODOを実運用のAnatomiaへ接続する

## 目的
Pf の TODO 一覧が実際の対象プロジェクトの解析根拠を表示できるようにする。

## 完了条件
- Anatomia のサービス所有 catalog / ProcessMap から接続先を確定する。
  分解時点では Ex のサービス一覧と通常リポ直下の catalog から定義を確認できなかった。
- Pf の `PRAEFORMA_ANATOMIA_URL` と、対象プロジェクトの `anatomiaRepo` を正本に合わせる。
  ポートの推測、秘密値のログ出力、未取得を空一覧とする回避策を行わない。
- マージ済みの TODO API と画面を本体へ反映する正規運用手順を確認する。
- 必要な起動確認は明示指示を得た範囲で行い、Concordia claim / release と
  Excubitor 経由・本体フォルダ限定を守る。無関係なサービスを再起動しない。

## スコープ (編集可ディレクトリ)
- Praeforma のサービス所有 catalog と実運用の接続設定。
- Pf のプロジェクト設定は既存 API / UI を用いる。
- Anatomia 自体の設定変更が必要な場合は、対象をAnとして別途claimする。
