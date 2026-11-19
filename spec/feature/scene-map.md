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

## キャンバス表示 (2026-11-19 改訂)

neco 指示:

> 遷移図はシーンのキャプチャを配置してそれを移動するFigmaライクなUIで行う。

PF-MAP-1 のカード一覧を、シーンのキャプチャを置いたキャンバスへ置き換える。カードの中身 (PF-MAP-2/3) はキャンバスで選んだシーンの詳細として出す。

| ID | 内容 |
| --- | --- |
| PF-MAP-7 | 各シーンはキャンバス上の 1 枚のノード。ノードにはシーン名・種類・仕様の件数と、キャプチャ (シーンエディタに取り込んだ元画像の先頭) を出す。キャプチャが無いシーンは「キャプチャなし」と出す。 |
| PF-MAP-8 | 遷移はノード間の矢印で引き、ラベル (無ければ trigger) を添える。同じ 2 シーン間の遷移は 1 本にまとめ、件数を出す。 |
| PF-MAP-9 | 閲覧モードでは、背景のドラッグで画面を動かし、ホイールと拡大・縮小ボタン (25%〜200%) で倍率を変える。ノードを押すと詳細 (PF-MAP-2/3 の内容) を横に出す。ノードは動かない。 |
| PF-MAP-10 | 「配置を編集」でノードをドラッグして動かせる。「保存」で全ノードの位置をまとめて保存、「やめる」で保存前の位置に戻す。編集できるのは owner / planner (シーンエディタの編集と同じ)。それ以外には「配置を編集」を出さない。 |
| PF-MAP-11 | 位置を保存していないシーンは、最初のシーンから遷移をたどった深さを列、列の中の順番を行にして自動で並べる。どこからもたどれないシーンは最後の列に並べる。 |
| PF-MAP-12 | ボタン配置と遷移そのものの編集は従来どおり ScreenFlow (「ボタン配置を編集」) で行う (PF-MAP-5)。 |

保存先は `scene_map_positions (layout_id PK, project_id, x, y, updated_by, updated_at)` (migration 029)。

## API

`GET /api/projects/:pid/scene-map` → `{ scenes: SceneMapScene[], unplacedSpecs: SceneMapSpecSummary[], canEdit }` (型は `shared/project-home.ts`)。各シーンに `position` (未保存なら null) と `hasCapture` を付ける。

`GET /api/projects/:pid/scene-map/scenes/:lid/capture` → キャプチャ画像そのもの (png / jpeg / webp)。無ければ 404。

`PUT /api/projects/:pid/scene-map/positions` `{ positions: [{ layoutId, x, y }] }` (最大 500 件、座標は ±100000)。プロジェクトに無いシーンが混ざれば 400 で何も保存しない。
集約は `server/src/lib/scene-map.ts` の純関数 `buildSceneMap`。

## 実装

- `server/src/lib/scene-map.ts` / `server/src/routes/scene-map.ts`
- `server/src/lib/scene-map-store.ts` (位置の読み書き・キャプチャの有無) / `scene-capture.ts` (キャプチャ選び)
- `shared/scene-map-layout.ts` — 自動配置 (PF-MAP-11)・矢印のまとめ (PF-MAP-8)・保存入力の検証
- `web/src/components/scene-map/SceneMapView.tsx` (見出し・編集の状態・詳細) / `SceneMapCanvas.tsx` (表示とドラッグ) / `SceneNode.tsx` / `SceneEdges.tsx` / `useCanvasView.ts` (移動と倍率) / `useSceneCapture.ts` / `SceneCard.tsx` (選んだシーンの詳細)
- `web/src/components/registration/SceneProposals.tsx` — 登録成功時の `onRegistered`。

## 検証

`server/src/lib/__tests__/scene-map.test.ts` (並び・直付けとアクター経由・遷移の順と除外)。
`scene-map-canvas.test.ts` (自動配置・矢印のまとめ・保存入力・キャプチャ選び)、`scene-map-positions.test.ts` (位置の保存・権限・知らないシーン・キャプチャ取得)。

## 表示仕様

閲覧状態を見出しに明示し、各シーンで受ける遷移数、配置仕様、行き先を区分する。

関連タスク `actio:f2751125-8483-4cc1-82c7-cbb02e2ed9b4`
