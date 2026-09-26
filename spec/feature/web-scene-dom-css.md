# WebUIシーンのDOM・CSS編集

WebUIのシーン内で画面ごとのDOMと共通CSSクラスを定義し、PC・スマホの表示領域で確認してHTML/CSS差分を実装者へ渡す。

- PF-WEB-1: DOMは安定したIDとparentId、タグ、文言、クラス、許可された属性を持つ。要素追加、親変更、兄弟順変更、子孫削除、プレビュークリックによる選択ができる。循環・未知親・深さ32超・void要素の子は保存拒否する。
- PF-WEB-2: プレビューはscript実行を許さないsandbox iframeで描画する。外部通信はCSPで拒否し、フォーム送信やボタンの実処理は実行しない。HTMLは許可タグだけを取り込み、リソースを持つタグはDOM解析前に拒否する。文言・属性をエスケープして出力する。
- PF-WEB-3: 名前付きCSSクラスを定義してDOMへ割り当てられる。単一クラス規則を貼り付けて取り込み、共通・PC（min-width:768px）・スマホ（max-width:767px）を指定できる。共通規則を先に出力し端末別規則で上書きする。未対応セレクタ・プロパティ・外部URLは明示エラーにする。
- PF-WEB-4: 同じシーンのPC/スマホframeは独立したDOM構造を持てる。CSSはシーン内で共有する。配置キャンバスのviewportをプレビューサイズとして使い、画面選択で切り替える。DOM/CSSのundo/redoを用意し、未保存変更の離脱警告と保存中の編集禁止を適用する。
- PF-WEB-5: DOM/CSSはscene_documents.payload.webに保存する。frame削除時に対応DOMを保存対象から外す。旧文書はwebなしで読み込める。保存権限、期待revisionの競合検出、プロジェクト隔離を既存APIで維持する。
- PF-WEB-6: 選択frameのHTML、シーン共通CSS、エディタを開いた時点との差分を表示・JSONダウンロードできる。差分はHTML/CSSへの変更であり、React/TSXソースへ自動適用するものではない。実装者が対応ソースへ適用しレビューする。
- PF-WEB-7: プレビュー上で要素をドラッグして位置を変えられる（グループ移動）。選んだ要素を子孫ごと動かし、タブ・メニューは親要素を選んで丸ごと動かす。位置は要素ごとのクラス `pf-pos-<要素ID>`（IDがクラス名に使えない文字を含むときは置換とハッシュを付ける）の `translate: Xpx Ypx` として保存し、DOM構造は変えない。規則の端末はプレビュー幅に合うメディアクエリで決める（767px以下はスマホ、768px以上はPC）。PC/スマホの位置は独立し、PF-WEB-3の出力順とPF-WEB-6の差分に載る。原点へ戻すと宣言を消し、空になった規則と使われなくなったクラスを外す。数値欄でも同じ規則を編集できる。文言(text)は位置を持てない。
- PF-WEB-8: 個別移動では、要素を今の親から分離して別の場所へ置くか、別の親へ統合する（parentIdと兄弟順の変更）。ドロップ先はポインタ下の要素から、移動中の部分木の外で子を持てる最も近い要素を選び、なければ画面の最上位に置く。兄弟の並びが行か列かで前後を決める。祖先・最上位への移動を分離、それ以外の親への移動を統合、同じ親での移動を並べ替えとして知らせる。循環・未知の親・void要素と文言の中・深さ32超は移動前に拒否し、移動した要素のその端末の位置は戻す。
- PF-WEB-9: ドラッグは親ページのオーバーレイで扱い、sandbox iframeにscriptを入れない（PF-WEB-2を維持）。操作は選択・グループ移動・個別移動から選ぶ。選択中はiframeが入力を受けてスクロールでき、移動中だけオーバーレイが入力を受ける。移動結果はDOM/CSS履歴に1手として積み、Undo/Redo・未保存の離脱警告・期待revisionの競合・保存時の検証はPF-WEB-4/5のまま効く。スマホ幅（760px以下）では「全画面でUIを編集」を開いている間だけPfのヘッダー・AI相談を隠し、編集画面を全面表示して保存・閉じるを置く。閉じると元の画面に戻り、PCは従来どおり。

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
| shared/web-scene-placement.ts | 位置クラスと端末別translate規則（PF-WEB-7） |
| shared/web-scene-tree.ts | 親変更・兄弟順・深さの検証（PF-WEB-8） |
| shared/web-scene-pointer.ts | 掴む要素・ドロップ先・並び位置の決定 |
| shared/web-scene-move.ts | グループ移動・個別移動のシーン更新 |
| preview-geometry.ts | プレビュー文書の座標読み取り |
| useWebPreviewDrag.ts | ドラッグの開始・追従・確定 |
| WebDomDragOverlay.tsx | 選択枠・ドラッグ枠・移動先の表示 |
| WebMoveModeControl.tsx | 選択/グループ移動/個別移動の切替 |
| WebNodePlacement.tsx | 位置の数値編集 |
| web-move-messages.ts | 移動結果とエラーの文言 |
| useMobileUiEditing.ts / WebUiEditBar.tsx | スマホ幅の全画面UI編集（PF-WEB-9） |

API保存・再取得・権限・競合はscene-editor.test.ts、契約・エスケープ・不正CSS・差分はweb-scene.test.ts、移動・分離・統合・位置CSSはweb-scene-move.test.tsで確認する。ブラウザーでの操作確認には実行許可と接続可能なブラウザーが必要。

## 受け入れ契約（PF-WEB-7〜9）

- C-1 groupMove(scene, frameId, nodeId, device, delta): 選んだ要素だけが `pf-pos-*` クラスを持ち、その端末の `translate` 規則が webCss の端末別メディアクエリと webMarkup の class に出る。
- C-2 deviceForViewport(width): 767px以下はmobile、768px以上はdesktopを返し、PCとスマホの位置は互いを変えない。
- C-3 individualMove(scene, frameId, nodeId, parentId, beforeId, device): parentIdと兄弟順を変え、分離・統合・並べ替えを区別し、その端末の位置を戻す。
- C-4 reparentNode(nodes, nodeId, parentId, beforeId): 循環・未知の親/兄弟・子を持てない要素・深さ32超を拒否し、結果は webSceneSchema を通る。
- C-5 dropParent / insertionPoint / grabTarget: 移動中の部分木とvoid要素・文言を避けたドロップ先、行/列に応じた並び位置、選択中グループの掴みを返す。
- C-6 WebDomPreview: iframeはsandbox="allow-same-origin"のままscriptを持たず、ドラッグは親ページのオーバーレイで扱う（画面確認は実行許可後）。
- C-7 useMobileUiEditing / scene-editor.css: スマホ幅で編集中だけPfのヘッダー・AI相談を隠して全面表示し、閉じると戻る。PCの表示は変えない（画面確認は実行許可後）。
