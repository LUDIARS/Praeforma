# unity-editor — Unity Editor 拡張仕様

`Packages/jp.ludiars.praeforma/` の UPM パッケージ仕様書。
mvp-plan Step 8 の前倒し対応 (= 2026-05-16 にユーザ指示で v0.1 着手)。

## スコープ

### v0.1 (実装済)

- 4 タブ Editor Window (Window > LUDIARS > Praeforma)
  - **Login**: backend URL + PASETO token、 接続テスト、 EditorPrefs 保存
  - **Projects**: project 一覧、 activate
  - **Feedback**: 選択中 `PraeformaPlaceholder` の FB 一覧 + 新規追加 + Scene focus
  - **References**: 選択中 placeholder の domain に紐づく外部 doc リンク + OS ブラウザで開く
- Runtime:
  - `PraeformaPlaceholder` — shape (cube/sphere/plane/cylinder/sprite/image)
    + color (#RRGGBB)、 OnDrawGizmos で wire 表示
  - `FeedbackMarker` — Melpomene 互換 (球体 + 旗、 state 色分け、 critical 時赤リング)
- UnityWebRequest 経由の REST 通信、 全リクエストに `Authorization: Bearer <PASETO>` 付与
- `Application.OpenURL` で reference を OS ブラウザに開く (= 「難しければ link」 方針)

### v0.2 候補

- **Scene View 直接配置**: Editor Window の Reload なしで Scene クリックで FB ピン生成
- **Reference webview embed**: vuplex 3D WebView (有償) or unity-webview (gree) を optional 統合
- **Reference markdown 取得**: Notion API / Google Docs API を backend 側で proxy、 取得 markdown を Editor 内で表示
- **layout 同期**: Praeforma project の layout を Unity Scene に流し込み (= placeholder GameObject の一括生成 + Prefab 差し替え)
- **acceptance probe**: spec_acceptance を Unity Runtime 側で評価して backend に結果送信

### v1.0 候補

- Cernere OAuth flow を Editor 内で完結 (= PASETO 手動コピーを廃止)
- Edit ops broadcast (= WebSocket /ws/edit) を Editor からも参加
- Project / Layout / Domain 作成 UI を Editor 内に内製

## アーキテクチャ

### asmdef 構造

```
Packages/jp.ludiars.praeforma/
├ Runtime/Praeforma.Runtime.asmdef   (player runtime + edit-time 共有)
└ Editor/Praeforma.Editor.asmdef     (Editor only、 Runtime に依存)
```

Runtime asmdef は player ビルドにも含まれる前提 (= ゲーム実機で
acceptance probe が動くため)。 v0.1 では Editor 専用機能だが、 構造は将来用に
分けてある。

### REST 通信

UnityWebRequest + `JsonUtility.ToJson` / `FromJson`。 SDK 追加なし。

| 機能 | path | method |
|---|---|---|
| project 一覧 | `/api/projects` | GET |
| references 一覧 | `/api/projects/:pid/references?target_kind=domain&target_id=...` | GET |
| reference 追加 | `/api/projects/:pid/references` | POST |
| reference 削除 | `/api/projects/:pid/references/:rid` | DELETE |
| feedback 一覧 | `/api/projects/:pid/feedback?layout=...&object=...&layout_object=...&state=...` | GET |
| feedback 個別 + comments | `/api/projects/:pid/feedback/:fid` | GET |
| feedback 追加 | `/api/projects/:pid/feedback` | POST |
| feedback 更新 (state 等) | `/api/projects/:pid/feedback/:fid` | PATCH |
| comment 追加 | `/api/projects/:pid/feedback/:fid/comments` | POST |

### 認証

PASETO V4 token を EditorPrefs に保存:

- `Praeforma.BaseUrl` (= backend URL)
- `Praeforma.Token` (= PASETO token)
- `Praeforma.LastProjectId` (= 最後にアクティブにした project)
- `Praeforma.LastLayoutId` (= reserved、 v0.2+)

token は per-machine、 平文。 Cernere の通常 sub claim を発行する想定なので
盗取時の被害は 1 user 1 project に限定される。

### Selection 追従

`UnityEditor.Selection.activeGameObject` を毎 OnGUI で取得 →
`GetComponent<PraeformaPlaceholder>()` で domain / object / layout_object id を解決。
- 選択中 placeholder あり: その placement に絞った FB / Reference を表示
- 選択中 placeholder なし: project 全体の FB を表示 / References は警告

### 既知の制限

- `JsonUtility` は `Dictionary<string,object>` をサポートしないので、
  jsonb 系フィールド (`labels` `world_position` 等) は `string[]` / `float[]`
  に型固定している
- 並行 edit 衝突は backend の 409 で検知するが、 v0.1 では UI で再表示するだけ
  (= 楽観的 retry なし)
- PASETO の自動 refresh はない、 expire したら Login で貼り直す

## Melpomene との対応

| Melpomene Ticket | Praeforma FeedbackDto |
|---|---|
| `id` | `id` |
| `github_issue_number` | `github_issue_number` (= 任意連携、 v0.2+) |
| `title` / `description` | `title` / `body` |
| `priority` | `priority` |
| `category` | `category` (+ `spec-clarification` 追加) |
| `labels[]` | `labels[]` |
| `milestone_id` | (v0.2+) `milestone_id` |
| `scene_name` | `scene_path` (= hierarchy path、 Melpomene と若干違う) |
| `object_path` | 同上 (scene_path に統合) |
| `world_position` | `world_position` |
| `screen_position` | `screen_position` |
| `state` | `state` (`open` / `in-progress` / `resolved` / `wont-fix`) |
| `author` | `created_by` (Cernere user UUID) |
| `assignees[]` | `assignee_user_id` (= 単一、 v0.2+ で多人数化) |
| `comments[]` | `feedback_comments` (別テーブル) |

## 関連

- README: `Packages/jp.ludiars.praeforma/README.md`
- backend spec: `spec/schema/feedback.md`, `spec/schema/reference.md`
- mvp-plan Step 8 (Unity UPM)、 Step 9 (Unity runtime probe)
- 参考: [Ars-Musa Melpomene](https://github.com/LUDIARS/Ars-Musa/tree/main/melpomene)
