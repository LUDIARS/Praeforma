---
task: "Anatomia解析からシーン候補を提案してPfへ登録する"
project: Pf
kind: implementation
created: 2026-09-08
memory_links: []
---

## 要求
neco: 「シーンの提案もAnatomia解析から拾えるように」。

## 実装範囲
Pfのシーン一覧から、紐付いたAnatomiaプロジェクトのcanonical scene解析結果を取得する。候補には解析元のID・名称・根拠を表示し、人が確認・調整してPfのシーンとして登録できるようにする。既存シーンとの重複を避け、接続設定不足や古い解析を明示する。

## 参照
- Anatomia: `src/adapters/web/routes/screens.ts`、`src/knowledge/scene/types.ts`、`spec/feature/scene-derivation.md`
- Pf: `web/src/components/registration/SceneRegistration.tsx`、`server/src/routes/anatomia.ts`

## 受け入れ条件
- シーンタブから解析由来の候補を取得・表示できる。
- 削除済み解析シーンを除外し、解析元と登録済みの対応を保持する。
- 登録は利用者の明示操作で行い、他プロジェクトへ書き込まない。
- 未設定・取得失敗・候補なしを区別して表示する。
- 候補選択、修正、登録、再取得時の重複防止を検証する。
