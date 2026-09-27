# Praeforma native overlay

Windows アプリへ `Praeforma.Tela.Native` を組み込む。Unity も同じソースを使う。
Tela を組み込んだ `praeforma_overlay.exe` と日本語対応 TrueType フォントを利用アプリが明示する。
`host/` は Tela のインストール済み CMake package を `find_package` で参照する。
隣のリポジトリへのパス依存は追加しない。

```sh
cmake -S libraries/native-overlay/host -B build-pf-overlay -DCMAKE_PREFIX_PATH=<Telaのインストール先>
cmake --build build-pf-overlay --config Release
ctest --test-dir build-pf-overlay --output-on-failure -C Release
```

このホストは「要素」「仕様」「実装・テスト」の表示を切り替える。基本要素は独立に切り替え、関連シナリオは一度に一つだけ選択する。
「シナリオ」で選択メニューを開く。長文は初期状態で折りたたみ、展開後の本文・項目・メニューはページ送りできる。
実装状況は Actio のタスク／バックログと人間確認を表示する。配備の接続設定は `spec/feature/scenario-experience.md` を参照。
本文は GameView の論理ピクセル幅で折り返すため、基本要素の縮尺と文字サイズを分けて扱う。
描画・クリック処理・ウインドウ透過・パイプ認証は Tela の公開 API に委ねる。

1. 認証済み Pf API の `GET /api/projects/:pid/review-overlay?layout_id=:lid&format=tela` を取得する。
2. 応答の `telaDocument` と、自プロセスが所有する HWND を `TelaReviewOverlay` に渡す。
3. アプリの更新時に `overlay.UpdateViewport(OverlayWindow.Beside(hwnd, 900, 700))` を呼ぶ。
4. シーン変更時は新しい文書を取得して交換し、終了時は必ず `Dispose()` する。

Tela は別プロセス。Beside は対象の外側へ表示し、モニタの空きに応じて反対側または作業領域内へ寄せる。
最小化・非表示では表示を隠す。例外や接続エラーは呼び出し元で表示する。
Unity では同じ接続に GameView の実描画領域を渡し、仕様と要素をゲーム画面上へ描画する。
資格情報はこのライブラリへ渡さず、利用アプリ側の HTTP クライアントだけが保持する。
