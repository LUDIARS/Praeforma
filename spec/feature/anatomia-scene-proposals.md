# feature: Anatomia 解析からのシーン候補提案

neco: 「シーンの提案も Anatomia 解析から拾えるように」(Actio eed52e8f / spec/tasks/2026-09-08-anatomia-scene-proposals.md)。

## Anatomia scene proposals

シーン一覧（プロジェクト画面の「シーン」タブ）で、紐付いた Anatomia プロジェクトの canonical scene 解析から
シーン登録の候補を取得し、利用者が確認・調整してから Praeforma のシーン（layout）として登録できる。

### 流れ

1. 「候補を取得」を押すと `GET /api/projects/:pid/anatomia/scene-proposals` が Anatomia の
   `GET /api/projects/:anatomiaRepo/scenes` を読み取り専用で参照する。
2. 候補ごとに解析元のシーン ID・名前・種別・由来と、根拠（解析元のファイルと行、検出理由）を表示する。
   Anatomia 側の注釈（annotation）があれば名前と説明はそれを優先する。
3. 利用者はシーン名・種類（UI 2D / ワールド 2D / ワールド 3D）・説明を調整し、「このシーンを登録」で
   `POST /api/projects/:pid/layouts` に `anatomia_scene_id` を付けて登録する。自動登録はしない。
4. 登録済みの候補は一覧の後ろに「登録済み」として出し、再取得しても登録候補には戻さない。

### 不変条件

- 正本は Anatomia の解析。Praeforma は解析を書き換えず、他プロジェクトへも書き込まない。
- 削除済み（tombstone）の解析シーンは候補に出さない。同じ ID は 1 件にまとめる。
- 解析元と登録済みの対応は `layouts.anatomia_scene_id`（spec/data/schema/layout.md）で持つ。同じプロジェクトで
  同じ解析シーンを持つ未削除 layout は 1 件だけ（partial unique index）。API は事前確認と一意制約の両方で
  `409 anatomia_scene_already_registered` を返す。
- 種類の初期値は Anatomia のシーン種別から提案するだけで、確定は利用者が行う。

### 状態の区別

| 状態 | 表示 |
|---|---|
| 接続先未設定 (`anatomia_unconfigured`) | サーバーの Anatomia URL 設定を案内 |
| プロジェクト未紐付け (`anatomia_repo_unset`) | プロジェクト設定で Anatomia リポの指定を案内 |
| Anatomia 側に無い (`anatomia_project_not_found`) | Anatomia の登録名の確認を案内 |
| 取得失敗 (`anatomia_unreachable` / `anatomia_failed` / `anatomia_bad_payload`) | Anatomia の稼働確認と再取得を案内 |
| 解析が古い (`stale`) | 理由を添えて、Anatomia で再解析してから取得し直すよう案内（候補は表示する） |
| 候補なし | 「解析にシーンが見つかりませんでした」 |
| すべて登録済み | 「候補はすべて登録済みです」 |

### 実装

- `server/src/lib/anatomia-scenes.ts`（取得・候補への変換。純関数 `toSceneProposals` はテスト対象）
- `server/src/routes/anatomia.ts`（`GET /scene-proposals`）、`server/src/routes/layouts.ts`（`anatomia_scene_id` と重複防止）
- `server/migrations/023_layout_anatomia_scene.sql`、`server/src/db/schema/layout.ts`、`server/src/db/sqlite-schema.ts`
- `web/src/components/registration/SceneProposals.tsx`
- テスト: `server/src/lib/__tests__/anatomia-scenes.test.ts`
