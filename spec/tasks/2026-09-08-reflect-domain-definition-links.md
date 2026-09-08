---
task: reflect-domain-definition-links
project: Praeforma
kind: 運用
created: 2026-09-08
memory_links:
  - spec/feature/domain-definition-links.md
---

# ドメイン関連付けと未露出警告を稼働Pfへ反映する

## 目的

Pfでコア／ビジネスドメインの価値を定義し、シーン定義・要件・Anatomiaのドメインと関連付ける。
シーン未露出は警告だけにし、コア定義の保存やシーンの削除を妨げない。

## 作業

1. マージ済み変更、実checkout、稼働版を照合する。追加列の移行とWebビルドを反映する。
   起動・再起動は許可された範囲でCcへclaimし、Ex経由でPf本体フォルダから行いreleaseする。
2. 明示的に動作確認が許可された場合、未露出coreの保存・警告、露出先追加後の警告解消、
   シーン削除後の警告、要件の関連付けと解除、Anatomia候補取得を確認し、TestWorkflowへ記録する。
3. 既存の未分類ドメインを勝手にcoreへ分類しない。MpのUX定義はPfの実装後に人間の指示で進める。

## 受入条件

- 稼働PfのDomainsから価値・分類と各参照を保存できる。
- coreの露出先が空でも保存でき、警告で不足を示す。
- 要件との関係はspec_targetsを使い、他の適用対象を消さない。
- テスト・起動の未実施と、実際に確認した内容を区別して報告する。
- 進行状態はCcのtaskflow_task_stateを正本とし、この文書へ書き戻さない。
