# Praeforma — Unity Editor Extension

Praeforma backend と連携する Unity Editor 拡張 (UPM パッケージ)。
Scene 上のオブジェクトに対するフィードバック (Melpomene 互換) と、
ドメインに紐づく外部 doc リンク (Notion / Confluence / Google 等) を扱う。

## インストール

### Package Manager (Git URL)

Unity > Window > Package Manager > `+` > "Add package from git URL...":

```
https://github.com/LUDIARS/Praeforma.git?path=Packages/jp.ludiars.praeforma
```

### ローカル clone から

`Packages/manifest.json` に追加:

```json
{
  "dependencies": {
    "jp.ludiars.praeforma": "file:../../Praeforma/Packages/jp.ludiars.praeforma"
  }
}
```

## 使い方

1. Unity Editor で **Window > LUDIARS > Praeforma** を開く
2. **Login** タブ: Backend URL (= `http://localhost:8889` 等) と PASETO token を貼り付け
   - token は Praeforma Web UI でログイン後にコピーする (= v0.1 は手動連携)
3. **Projects** タブ: Project 一覧から Activate
4. Scene の GameObject に `PraeformaPlaceholder` component をアタッチし、
   `layoutObjectId` / `objectId` / `domainId` を入力 (= backend のレコードと紐付け)
5. **Feedback** タブ:
   - 選択中 GameObject の placement に紐づく FB を表示
   - 新規 FB をその場で投稿可能 (world_position は GameObject 位置から自動入力)
6. **References** タブ:
   - 選択中 GameObject の `domain` に紐づく外部 doc リンク一覧
   - **Open in Browser** で Notion / Confluence / Google Docs / Figma 等を OS ブラウザで開く

## Scene Gizmo

- `PraeformaPlaceholder`: shape (cube / sphere / plane / cylinder) と color
  (#RRGGBB) で 1 個 ずつ wire 表示
- `FeedbackMarker`: 球体 + 縦旗、 state による色分け (open=黄 / in-progress=青 /
  resolved=緑 / wont-fix=灰)、 critical priority は赤いリング
  - Melpomene の旗 gizmo パターンを踏襲

## 認証

PASETO V4 (Cernere 発行)。 EditorPrefs に保存。 値は per-machine、
**チーム共有しないでください** (= 個人 token)。

## 制限事項 (v0.1)

- References の `webview` / `markdown` モードは未実装 → `link` のみ
  (= OS ブラウザで開く)
- Feedback の Scene View gizmo 自動配置は未実装 (= component を手動でつける)
- Project 作成 / Layout 作成 / Domain 作成は Web UI から (= Editor からは閲覧主体)

## アーキ

```
Packages/jp.ludiars.praeforma/
├ package.json                       UPM manifest
├ Runtime/
│  ├ Praeforma.Runtime.asmdef
│  ├ PraeformaPlaceholder.cs         placeholder gizmo (cube/sphere/plane/cylinder)
│  ├ FeedbackMarker.cs               FB gizmo (球体 + 旗、 Melpomene 互換)
│  └ Models/PraeformaModels.cs       DTO (UnityEngine.JsonUtility 互換)
└ Editor/
   ├ Praeforma.Editor.asmdef
   ├ PraeformaWindow.cs              4 タブ Editor Window
   ├ Api/
   │  ├ AuthStorage.cs               EditorPrefs persistence
   │  └ PraeformaApi.cs              UnityWebRequest client
   └ Views/
      ├ LoginView.cs                 URL + token + connection test
      ├ ProjectListView.cs           list / activate
      ├ FeedbackView.cs              list + create (Selection 追従)
      └ ReferenceView.cs             list + create + Open in Browser
```

## 関連

- Praeforma backend: <https://github.com/LUDIARS/Praeforma>
- 参考: [Ars-Musa Melpomene](https://github.com/LUDIARS/Ars-Musa/tree/main/melpomene)
- 仕様: `spec/unity-editor.md` (= Praeforma リポ内)
