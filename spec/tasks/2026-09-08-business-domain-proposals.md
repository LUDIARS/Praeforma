---
task: "[Pf] 未登録ドメインを列挙しコアとの対比でビジネスドメインを提案"
project: Pf
kind: implementation
created: 2026-09-08
memory_links: []
---

## 目的と範囲

[機能仕様](../feature/business-domain-proposals.md)に従い、仕様と任意のAnatomiaカタログを使い、登録済みコアとの関係が分かるビジネスドメイン候補を列挙する。

## 受け入れ条件

1. 未登録名、責務、価値、コアとの関係・相違、出典が表示される。
2. 登録済み名や架空の出典・コアを持つ案を拒否する。
3. 利用者が採用した候補だけbusinessとして登録される。
4. Anatomia照合を選んだ際の接続失敗と未登録なしを区別する。

## 検証

型検査・Webビルド。提案の参照・重複検証ケースをRevisorへ提出。AI/Anatomiaへの実接続確認は本体反映後に行う。
