---
task: web-scene-wysiwyg-move
project: Praeforma
kind: 実装
created: 2026-09-26
memory_links:
  - spec/feature/web-scene-dom-css.md
  - spec/data/schema/scene-editor.md
---
# WebUI シーン編集で画面 UI を WYSIWYG に動かす

Actio `actio:0db65860-1eb5-4269-84f3-d547b5336e7f`（委託 run `b00dd6d9-be07-4c03-aba9-28ccff1aac39`）のタスク分解。
要求の原文は Actio にあり、ここへは写さない。

## タスク分解

1. shared: 位置を CSS として持つ規則（要素ごとの `pf-pos-*` クラス、端末別 `translate`）と、許可 CSS への `translate` 追加（PF-WEB-7）。
2. shared: 親変更と兄弟順・深さの検証、分離/統合/並べ替えの区別（PF-WEB-8）。
3. shared: 掴む要素・ドロップ先・並び位置の決定（行/列）。
4. web: 親ページのオーバーレイでドラッグを扱い、sandbox iframe に script を入れない。選択・グループ移動・個別移動の切替、位置の数値編集（PF-WEB-9）。
5. web: スマホ幅で「全画面でUIを編集」を開いている間だけ Pf のヘッダー・AI相談を隠し、保存・閉じるを置く（PF-WEB-9）。
6. 仕様（PF-WEB-7〜9・実装表・受け入れ契約 C-1〜C-7）とテスト（web-scene-move.test.ts）。
7. local PR を Revisor へ提出。マージ・反映は指示を受けてから。

## 完了条件

- [spec/feature/web-scene-dom-css.md](../feature/web-scene-dom-css.md) PF-WEB-7〜9 を満たす。
- server / web の型チェックが通る。単体テストは書き、実行は明示の許可があるとき（Revisor が回す）。
- ブラウザーでのドラッグ・スマホ全画面の確認は実行許可と接続可能なブラウザーが揃ってから行う。
