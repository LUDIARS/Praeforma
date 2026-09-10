# WebUIシーンのDOM・CSS編集

WebUIのシーン内で画面ごとのDOMと共通CSSクラスを定義し、PC・スマホの表示領域で確認してHTML/CSS差分を実装者へ渡す。

- PF-WEB-1: DOMは安定したIDとparentId、タグ、文言、クラス、許可された属性を持つ。要素追加、親変更、兄弟順変更、子孫削除、プレビュークリックによる選択ができる。循環・未知親・深さ32超・void要素の子は保存拒否する。
- PF-WEB-2: プレビューはscript実行を許さないsandbox iframeで描画する。外部通信はCSPで拒否し、フォーム送信やボタンの実処理は実行しない。HTMLは許可タグだけを取り込み、リソースを持つタグはDOM解析前に拒否する。文言・属性をエスケープして出力する。
- PF-WEB-3: 名前付きCSSクラスを定義してDOMへ割り当てられる。単一クラス規則を貼り付けて取り込み、共通・PC（min-width:768px）・スマホ（max-width:767px）を指定できる。共通規則を先に出力し端末別規則で上書きする。未対応セレクタ・プロパティ・外部URLは明示エラーにする。
- PF-WEB-4: 同じシーンのPC/スマホframeは独立したDOM構造を持てる。CSSはシーン内で共有する。配置キャンバスのviewportをプレビューサイズとして使い、画面選択で切り替える。DOM/CSSのundo/redoを用意し、未保存変更の離脱警告と保存中の編集禁止を適用する。
- PF-WEB-5: DOM/CSSはscene_documents.payload.webに保存する。frame削除時に対応DOMを保存対象から外す。旧文書はwebなしで読み込める。保存権限、期待revisionの競合検出、プロジェクト隔離を既存APIで維持する。
- PF-WEB-6: 選択frameのHTML、シーン共通CSS、エディタを開いた時点との差分を表示・JSONダウンロードできる。差分はHTML/CSSへの変更であり、React/TSXソースへ自動適用するものではない。実装者が対応ソースへ適用しレビューする。

## 実装と検証

| ファイル | 責務 |
|---|---|
| shared/web-scene.ts | DOM/CSS契約と検証 |
| shared/web-scene-export.ts | inert HTML/CSS、プレビュー文書、差分の出力 |
| shared/scene-editor.ts | frame参照と保存要求の検証 |
| server/src/routes/scene-editor.ts | 権限・競合を伴う永続化 |
| web/src/lib/scene-editor-api.ts | 保存要求の転送 |
| SceneWorkspace.tsx | シーン保存と未保存状態 |
| WebSceneEditor.tsx | 画面別DOM編集と出力UI |
| WebDomInspector.tsx | DOM属性と親・クラス編集 |
| WebDomPreview.tsx | 隔離プレビューと要素選択 |
| WebCssEditor.tsx | CSS定義の編集UI |
| web-dom-import.ts | HTMLの取り込み |
| shared/web-class-import.ts | 単一クラスCSSの取り込み |
| useWebSceneHistory.ts | DOM/CSS履歴 |

API保存・再取得・権限・競合はscene-editor.test.ts、契約・エスケープ・不正CSS・差分はweb-scene.test.tsで確認する。ブラウザーでの操作確認には実行許可と接続可能なブラウザーが必要。
