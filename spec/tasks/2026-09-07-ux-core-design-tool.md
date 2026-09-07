# Praeforma を UX・コアドメイン設計ツールとして通す

## Problem

既存 Screen Flow は layout / scene と domain を主要な対象として扱い、画面構成がドメイン境界に
見える危険があった。また、LLM 提案、過去判断、人間の採否、実装・検証証拠が一つの版管理された
流れになっていなかった。

## Result

- UX scenario / use case を入力に、画面とは独立したコアドメイン境界候補を生成する。
- Anatomia の既存ドメインを参照し、supporting / generic は Anatomia 管理対象として表示する。
- Genius の実在カードを候補ごとに適用可能・不適用・未確定へ評価し、人間判断後だけ判断カードを蓄積する。
- Figma ライクな canvas で frame、画面状態、動的要素、追従 UI、transition を編集する。
- 画像を vision content block で解析し、編集可能な候補として差分採用する。
- Anatomia 実装グラフ、実装記録、テスト記録を source project と各 revision 付きでまとめる。
- Mp と MN の evidence を分離し、Mp の結果を MN へ継承しない。

既存 Screen Flow と既存データは削除せず、UX Core Design を新しい主要導線として追加する。

## Validation

- `npx tsc --noEmit -p server/tsconfig.json`
- `npx tsc --noEmit -p web/tsconfig.json`

ユーザーの Cc Session 作業ポリシーにより、単体・統合・動作・起動テストは実行しない。
上記は型検査のみであり、サービスの稼働確認済みを意味しない。Revisor local PR は作成直後に
自動テストと auto-merge queue を開始し、無実行 draft 経路がないため、この変更は commit と
レビュー可能な本文までで提出待ちとする。
