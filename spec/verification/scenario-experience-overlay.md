# シナリオ・確認オーバーレイ・一覧の検証記録

作業日: 2026-09-27。対象: Pf / Praeforma。
作業ブランチ: `feat/scenario-experience-overlay`。
追加の Actio 側: `feat/praeforma-implementation-review`（ローカル main `29f0b81` 起点）。
起点: ローカル main `7c29a20`。専用 worktree で実装し、共有 main は編集していない。

## 根拠と実装範囲

ユーザー指示は、シナリオの意味・カテゴリ、基本シーンと追加パーツの分離、ブラウザ／アプリ／Unity の
仕様・検証オーバーレイ、およびプロジェクト検索・チーム条件保存までを含む。
`spec/feature/scenario-experience.md` と `spec/schema/scenario-experience.md` に契約を記録した。

既存仕様は `ux-core-design.md`、`integrated-scene-editor.md`、`acceptance-summary.md` と照合した。
Anatomia の `praeforma` context と Pf の登録情報を読み取りで確認した。
既存の scene document、UX revision、acceptance summary、Tela scene overlay を利用する。
Tela の公開 API をソースで照合した。Tela リポジトリそのものは変更していない。
ブラウザライブラリ、native .NET 所有者、Tela companion、Unity Editor 連携の導入手順は各 README に記載した。

## 現在の検証状態

- ユーザーの「検証を許可」を受けて実行。以前の型確認拒否は、この明示許可を得るまで再実行しなかった。
- server / web: `tsc --noEmit` 通過。Vite 6.4.3 の本番 build 通過（2350 modules）。500 kB 超の chunk 警告は残る。
- 追加した 4 テストファイルの 7 件が成功。シーン・レイヤー・デバイス・受入テスト集計の既存回帰 11 件も成功。合計 18 件。
- `.NET SDK 8.0.202`: `Praeforma.Tela.Native` (netstandard2.1) build 通過、警告 0・エラー 0。
- MSVC 19.39 / Ninja / Release: `praeforma_overlay.exe` build 通過。Tela の公開ヘッダと既存 Release 成果物を検証用の配布構成にステージして使用した。
- CTest `praeforma_review`: 成功。UTF-8 本文の折り返し・全文保持、本文／シナリオメニューのページ送り、シナリオ排他選択、基本要素の独立切替、非表示 viewport の宣言破棄を確認した。
- Unity 6000.3.10f1 付属 Roslyn と実参照 DLL: Runtime / Editor / Editor.Tests / Tela adapter がすべてコンパイル成功。Editor.Tests の NUnit 実行ではない。Editor は起動していない。
- `git diff --check`: 通過。
- Browser runtime の初期化は成功したが、利用可能なブラウザ一覧は 0 件。ブラウザ・Unity GameView の実表示は未確認。
- DB migration、共有サービスの起動／再起動、実データへの変更、公開、push、merge は行っていない。
- Lictor セッション宛先を示す `LICTOR_PORT` が当該ツール環境にない。Cc task/work phase 登録と Revisor 提出は未実施。古いセッション ID で代用していない。

## 検証中に修正した点

- 現行 Tela.Editor に存在しない旧 `SceneOverlayConnection` への必須参照を除いた。GameView は
  native companion のみを必要とし、旧 Scene view の公開 API が導入されている場合だけ従来接続を利用できる。
  不在時は明示エラーとなり、内部 API への代替接続を行わない。
- GameView が小さくても本文をフレーム縮尺で縮めず、論理幅で再折り返ししてページに分ける。
- NuGet と MSVC の環境不足は、検証プロセスに標準の Windows パスを明示して解決した。
  グローバル設定変更やコンパイラの追加インストールはしていない。

## 実行した自動検証と残る操作確認

1. server/web の TypeScript 型確認、Web build。
2. `project-index.test.ts`、`scenario-experience.test.ts`、`review-overlay.test.ts`、`scenario-overlay-route.test.ts`。
   検索のページ順、保存無効化、操作を伴わない表現、カテゴリと必須本文、同一プロジェクト参照、
   シーン更新による根拠の再確認、権限境界、長文ページ、未実施・版不明の表示を対象にする。
3. native .NET と `praeforma_overlay` のビルド、Unity Editor のコンパイル。

上記 1–3 は実行済み。以下の実表示・操作確認が残る。

4. 一覧で検索→チーム指定→再訪→保存オフ→再訪の流れ。ページ後半にあるプロジェクトも検索対象か。
5. シナリオのカテゴリ変更、表現指示書、シーン参照、追加パーツ、画面遷移、基本シーン更新後の表示。
6. ブラウザ overlay の開閉、シーン切替、認証／取得失敗、途中のリクエスト破棄、アンマウント。
7. Unity の同名一意対応／曖昧対応／保存済み GUID 対応／未保存シーン対応、アクティブシーン切替、
   GameView の DPI・ドッキング・Play mode・最小化・フォーカス変更、長文・多数シナリオの操作。
8. アプリ外側への表示、接続失敗、ホスト終了、ウインドウ閉鎖・domain reload・Editor 終了後に
   所有プロセス・パイプ・一時文書が残らないこと。

起動を伴う確認は Cc claim / Excubitor の管理手順に従う。検証許可は取得済みだが、
自セッションの Lictor 接続情報と利用可能なブラウザが必要。許可不足による保留ではない。
未確認を成功扱いせず、結果をここへ追記する。

## 公開形式の制約

チームは現行データモデルの orgId を表示する。別のチーム名辞書は導入していない。
scene document が複数画面を持つ場合、Unity は先頭画面を表示する。API 利用者は frame_id を指定できる。
Tela 文書は現行上限 32 グループ・1024 要素を超えると明示エラーになる。
GameView の内部 API と DPI 座標変換を利用するため、実際の Editor バージョンで位置と文字の可読性を確認する必要がある。

## 追加指示への対応と検証

要素と仕様本文を分離し、長文を初期状態で折りたたむ。「実装・テスト」では Actio の状態を表示する。
実装状況は Actio タスク／バックログを正本とし、タスク完了・人間確認待ち・人間確認済みを区別する。
追加バックログ、仕様の変更、タスクの再開・内容変更は再確認へ戻す。
Actio の既存 Pf 取り込み、チーム認可、API クライアント認証、planning repository と照合して実装した。

- Pf の追加 `actio-implementation.test.ts` 2 件成功。既存の overlay/route テストを新しい形式へ更新し成功。
  初回の 18 件に追加 2 件を合わせた 20 件のユニークなテストを実行済み（全件を毎回再実行したという意味ではない）。
- Actio の `implementation-review.test.ts` 4 件、`implementation-routes.test.ts` 4 件と既存 planning 9 件を検証。
- Pf / Actio の backend・frontend TypeScript 確認、両 Web の本番 build、Actio の変更 UI に対する ESLint が成功。
  Vite の大きな chunk 警告と Actio の既存 `__dirname` 設定警告は残る。
- C++ の変更を再ビルド。日本語・絵文字を含む長文を Pf の exporter から実際の `.tela` ファイルへ出力し、
  Tela loader で読み取って、末尾保持・折りたたみメタデータ・状態表示を確認した。
  モード切替・本文の折りたたみと展開・本文とシナリオのページ送り・選択解除・非表示は C++ テストで成功。
- browser overlay の JavaScript 構文確認は成功。DOM の実操作・スクリーンショット検証は未実施。
- SQLite の追加 DDL をインメモリテストで再適用して履歴保持を確認。PostgreSQL の実 DB migration は未実施。
- 新しい Actio 連携 API をログイン済みの実サービス間で実行した検証は未実施。接続設定も変更していない。
- Cc task 登録は既存 main と専用 Actio worktree の両方から試し、いずれも `LICTOR_PORT not set`。
  自セッションの接続情報がないため、Cc 状態記録・Revisor 提出・マージ確認は依然として未実施。
