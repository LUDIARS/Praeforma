# Praeforma GameView specification overlay

Windows Unity Editor で Pf の仕様・検証状況・シーン基本要素・シナリオ追加パーツを Tela で表示する。
Praeforma 本体とこの任意パッケージを導入し、Pf ウインドウで接続先・認証・プロジェクトを選ぶ。
GameView は Tela のネイティブ配布物を使い、Tela.Editor アセンブリを必要としない。

1. Pf の `libraries/native-overlay/host` を、インストール済み Tela の CMake package でビルドする。
2. `Window > LUDIARS > Praeforma GameView Overlay` を開く。
3. `praeforma_overlay.exe` と日本語対応 `.ttf` の絶対パスを設定する。
4. GameView を開き、ゲーム画像全体が見えるズームにして「仕様オーバーレイを開始」を押す。
5. Pf シーンが同名で一つなら自動対応する。曖昧な場合はこのウインドウの Pf シーン一覧で選ぶ。
6. Tela 上の `Scenarios / specs` から ON/OFF ボタンで仕様ページや関連シナリオを切り替える。
   `<` / `>` はメニューのページ送り。選択後は本文へ戻る。本文も表示領域に合わせて折り返し・ページ送りする。

保存済み Unity シーンの対応はプロジェクトパス・Pf 接続先・Pf プロジェクト・シーン GUID ごとに
EditorPrefs へ保存する。未保存シーンはそのウインドウ内だけの対応になる。
アクティブシーンを変更すると旧表示を破棄して再取得する。仕様を編集した後は「仕様を再取得」を押す。
GameView にフォーカスがない間は表示を隠す。停止・ウインドウを閉じる・domain reload・Editor 終了で
通信と所有している Tela プロセスを破棄する。旧 Scene view 接続は公開 `SceneOverlayConnection` API を
持つ Tela.Editor が別途導入されている場合に利用でき、不在時は明示エラーになる。

GameView 内部の `viewInWindow` / `targetInView` を参照するため、未対応 Editor バージョンは明示エラーになる。
構造の参照元: [Unity GameView source](https://github.com/Unity-Technologies/UnityCsReference/blob/master/Editor/Mono/GameView/GameView.cs)。
DPI・ドッキング・Play mode を含む実表示の確認状況は `spec/verification/scenario-experience-overlay.md` に記録する。
