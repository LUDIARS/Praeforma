# Studio の Anatomia グラフ直接取得

## 目的

Studio の関連処理グラフ取得を中継サービスへの依存から外し、Anatomia の既存 Graph API を直接利用する。

## 完了条件

- `PRAEFORMA_ANATOMIA_URL` と任意の `PRAEFORMA_ANATOMIA_TOKEN` で Graph API を呼ぶ。
- ドメイン実装アンカーと検索語で部分グラフを選び、code-graph スキーマへ正規化する。
- 未設定・上流失敗は明示エラー、空選択は理由付き空グラフにする。
- 純粋選択関数を既存テストランナーの fixture で検証し、screen-flow ドメインへ登録する。
- Studio 仕様と README を直接連携の説明へ更新する。
