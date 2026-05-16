# Praeforma

**仕様書 ↔ 実装連携ツール** — プランナーが placeholder で配置 + 仕様を書く →
デザイナーが art を当てる → プログラマーが仕様通り実装する、 を 1 つの
プロジェクトとして繋ぐ汎用ツール (ゲーム / 業務システム / 教育コンテンツ等)。

> 命名: Latin **Praeforma** = 「前形 / 雛形 / template」。 placeholder という
> 「後で実体が入る型枠」 を作り、 designer / programmer がそこに具体物を
> 当てていく — 本ツールの本質をそのまま表す名前。 略称: **Pf**

詳細仕様: [spec/praeforma.md](spec/praeforma.md)

## ステータス

設計フェーズ。 まず仕様書を書いている段階で、 実装は未着手。

## 想定プラットフォーム

- Unity (UPM パッケージ + editor 拡張)
- WebGL (three.js / Babylon.js)
- 2D Web (Canvas / SVG)
- (将来) Godot / native mobile

## 関係

- **Ars** — ゲーム開発のアセット集積。 Praeforma は Ars のアセットを使う側
- **LUDIARS** — 認証 (Cernere) / 通知 (Nuntius) / observability (Excubitor)
  等は将来連携の余地あり (collaboration / multi-user 編集モード時)
