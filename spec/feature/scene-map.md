# 遷移図 (シーン中心)

## 目的

2026-11-19 neco 指示:

> 遷移図はシーンをメインに置き仕様を配置します。
> ボタンの配置などをいじれるEditモードはあるけど基本画面はReadonlyにします。
> これは既存のシーンの自動インポートにも対応します。

従来の「遷移図」タブ (Mermaid だけ) を、シーンを主役にしたカード一覧へ置き換える。Mermaid の全体図は折りたたみで残す。

## 要件

| ID | 内容 |
| --- | --- |
| PF-MAP-1 | シーン (削除済みを除く layouts) をカードで並べる。最初のシーン (`is_default`) を先頭、残りは名前順。 |
| PF-MAP-2 | 各カードにそのシーンへ置いた仕様を出す。シーン直付け (`spec_targets.kind='layout'`) と、シーンに配置したアクター経由 (`kind='object'` × `layout_objects`) の両方。両方に当たる場合は直付けとして 1 回だけ出す。 |
| PF-MAP-3 | 各カードに出ていく遷移 (行き先・ラベルか trigger・条件) を ordinal 順に出し、入ってくる遷移の数を出す。削除済みのシーンが端の遷移は出さない。行き先を押すとそのカードへスクロールする。 |
| PF-MAP-4 | どのシーンにも置いていない体系仕様は折りたたみで一覧する。仕様コードを押すと仕様確認でその仕様を開く。 |
| PF-MAP-5 | 基本は読み取り専用。「編集モード」は ScreenFlow (`/projects/:pid/flow`、ボタン配置と遷移の編集) を開く。 |
| PF-MAP-6 | 「既存シーンを取り込む」は Anatomia の解析シーン候補 (anatomia-scene-proposals.md) をその場で出し、登録すると遷移図を取り直す。Anatomia から取り込んだシーンには「取り込み」印を付ける。 |

## API

`GET /api/projects/:pid/scene-map` → `{ scenes: SceneMapScene[], unplacedSpecs: SceneMapSpecSummary[] }` (型は `shared/project-home.ts`)。
集約は `server/src/lib/scene-map.ts` の純関数 `buildSceneMap`。

## 実装

- `server/src/lib/scene-map.ts` / `server/src/routes/scene-map.ts`
- `web/src/components/scene-map/SceneMapView.tsx` / `SceneCard.tsx`
- `web/src/components/registration/SceneProposals.tsx` — 登録成功時の `onRegistered`。

## 検証

`server/src/lib/__tests__/scene-map.test.ts` (並び・直付けとアクター経由・遷移の順と除外)。
