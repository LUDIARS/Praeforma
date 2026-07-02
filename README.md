# Praeforma

**仕様書 ↔ 実装連携ツール** — プランナーが placeholder で配置 + 仕様を書く →
デザイナーが art を当てる → プログラマーが仕様通り実装する、 を 1 つの
プロジェクトとして繋ぐ汎用ツール (ゲーム / 業務システム / 教育コンテンツ等)。

> 命名: Latin **Praeforma** = 「前形 / 雛形 / template」。 placeholder という
> 「後で実体が入る型枠」 を作り、 designer / programmer がそこに具体物を
> 当てていく — 本ツールの本質をそのまま表す名前。 略称: **Pf**

詳細仕様: [spec/praeforma.md](spec/praeforma.md)

## ステータス

v0.1 実装済 (main マージ済)。 spec (`spec/`) を正本に、 以下が動く:

- **server/** — Hono + Drizzle + Postgres。 REST CRUD (projects / domains /
  objects / layouts / specs + references / feedback / acceptance / assets)、
  Cernere PASETO 認証 + role gate、 WebSocket collab (`/ws/edit`)
- **web/** — React + Vite。 project 一覧 / 2D 配置 editor / 3D preview (three.js) /
  Studio (要件定義モード)。 ローカルレビューモード (SQLite + Cernere 不要) あり
- **Packages/jp.ludiars.praeforma/** — Unity UPM v0.1 (Editor Window +
  placeholder gizmo + feedback + references)

残: Unity UPM v0.2 (layout 同期) / Unity runtime probe / 実 S3 adapter
(進捗の正本: [spec/plan/mvp-plan.md](spec/plan/mvp-plan.md))

## 想定プラットフォーム

- Unity (UPM パッケージ + editor 拡張)
- WebGL (three.js / Babylon.js)
- 2D Web (Canvas / SVG)
- (将来) Godot / native mobile

## 関係

- **Ars** — ゲーム開発のアセット集積。 Praeforma は Ars のアセットを使う側
- **LUDIARS** — 認証 (Cernere) / 通知 (Nuntius) / observability (Excubitor)
  等は将来連携の余地あり (collaboration / multi-user 編集モード時)
