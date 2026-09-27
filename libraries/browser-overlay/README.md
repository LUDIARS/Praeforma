# Praeforma browser overlay

ブラウザ実装へこのパッケージの `.mjs` ファイル一式を組み込む。フレームワーク依存なし。
表示する Pf の URL とプロジェクトは利用アプリが明示する。

```js
import { mountPraeformaOverlay } from './praeforma-overlay/index.mjs';
const overlay = mountPraeformaOverlay({
  baseUrl: pfUrl, projectId, layoutId,
  headers: () => ({ Authorization: `Bearer ${sessionToken}` }),
});
// アプリの画面変更時
await overlay.setScene(nextLayoutId);
// アプリ終了・コンポーネント破棄時
overlay.destroy();
```

同じ origin の認証済み proxy を使う場合は、その URL を baseUrl に渡す。
別 origin では Pf の許可 origin 設定と認証が必要。ライブラリは資格情報を保存せず、
認証の迂回やサービスの起動を行わない。表示は「更新」ボタンで再取得する。
仕様は HTML として実行せずテキスト表示。テスト要約はプロジェクト全体であり、
選択シナリオの合格を意味しない。仕様版不明と古い根拠もそのまま表示する。

「要素」「仕様」「実装・テスト」の表示を切り替えてもシナリオ選択は維持する。
長い本文は見出しを残して折りたたむ。要素表示はシーンの基本構成とシナリオの追加パーツを別々に示す。
実装状況は Pf サーバーが取得する Actio のタスク／バックログと人間確認の状態。
Actio の資格情報をこのライブラリへ渡さない。設定は `spec/feature/scenario-experience.md` を参照。
