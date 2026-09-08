# Praeforma

**UX・コアドメイン設計 ↔ 実装連携ツール** — UX scenario と use case から責務・業務ルール・
コアドメイン境界を設計し、編集可能な画面フロー、Anatomia の実装、版付きの検証証拠を
一つのプロジェクトとして繋ぐ汎用ツール。

> 命名: Latin **Praeforma** = 「前形 / 雛形 / template」。 placeholder という
> 「後で実体が入る型枠」 を作り、 designer / programmer がそこに具体物を
> 当てていく — 本ツールの本質をそのまま表す名前。 略称: **Pf**

詳細仕様: [spec/praeforma.md](spec/praeforma.md)

UX・コアドメイン設計: [spec/feature/ux-core-design.md](spec/feature/ux-core-design.md)

プロジェクトの「データ設計」から、データセット・項目・型・参照・保護方針と、
Cernere を含む項目ごとの論理保存先を設計できます。版付きで保存し、設計 JSON と保存先一覧を
書き出せます。詳細: [データスキーマと論理保存先](spec/feature/data-design.md)。

Studio の関連処理グラフは `PRAEFORMA_ANATOMIA_URL`（任意で `PRAEFORMA_ANATOMIA_TOKEN`）を用いて Anatomia
の API から直接取得する。対象プロジェクトには `anatomia_repo` の設定も必要。詳細は
[Studio 仕様](spec/feature/studio.md) を参照。

## ステータス

UX・コアドメイン設計の初期実装まで完了。型検査済みで、単体・統合・動作・起動テストは未実施。

## 想定プラットフォーム

- Unity (UPM パッケージ + editor 拡張)
- WebGL (three.js / Babylon.js)
- 2D Web (Canvas / SVG)
- (将来) Godot / native mobile

## 関係

- **Ars** — ゲーム開発のアセット集積。 Praeforma は Ars のアセットを使う側
- **LUDIARS** — 認証 (Cernere) / 通知 (Nuntius) / observability (Excubitor)
  等は将来連携の余地あり (collaboration / multi-user 編集モード時)
