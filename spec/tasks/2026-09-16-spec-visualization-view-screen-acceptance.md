---
task: spec-visualization-view-screen-acceptance
project: Praeforma
kind: テスト
created: 2026-09-16
memory_links:
  - spec/feature/spec-visualization-view.md
  - spec/feature/integrated-scene-editor.md
---
# 仕様書可視化ビューの画面を実際に開いて確認する

## 目的

PF-SPEC-VIEW の実装は型検査と書き出しの固定値テストまでで、画面を開いた確認をしていない。
可視化タブが描画され、軸の切り替え・グループの表示切り替え・Tela への書き出しが
実際に動くことを確認する。

## 完了条件

- `npm run build:web` の後、Excubitor 経由で praeforma を反映し、起動前に Concordia へ testing claim を入れる。
- 仕様タブの「可視化」を開き、カードが選んだ軸のグループへ分かれて描かれることを確認する。
- 軸 (状態 / 分類 / 優先度) の切り替えでグループの分かれ方が変わることを確認する。
- グループの ON/OFF が図へ反映され、仕様・版・保存内容が変わらないことを確認する。
- 「この図を Tela 用に書き出す」で保存したファイルが Tela の `--spec-view` で読めることを確認する。
- 仕様 0 件・上限超過のとき、欠けたまま書き出さずに知らせることを確認する。
- Pf の画面と Tela のオーバーレイが同じ配色・同じ配置になることを見比べて確認する。
- 終了後に claim を release する。

## スコープ (編集可ディレクトリ)

web/、server/、spec/。他リポは対象外。worktree からのサービス起動は禁止。
