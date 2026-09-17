# Unity Editor表示・指示とTela任意接続の確認

## 実装内容

UX-PF-UNITY-1 / PF-UNITY-EDITOR。Unityで作業対象とPfの仕様・依頼を見失わないため、
既存UPMのEditorWindowに仕様一覧、指示保存、オーバレイ接続のタブを追加した。
仕様は50件ずつ読み、古い接続先・プロジェクトへの応答で画面を上書きしない。
指示は対象のGlobalObjectIdを任意で添えて既存の仕様断片APIへ保存する。
最初の送信前にpayloadとUUIDを固定・SessionStateへ保存し、結果不明時は同じ要求を再送する。
SessionStateはEditor完全終了を越える永続化ではない。AI実行やUnityコマンド実行は含めない。

認証は通常のtokenと明示的なloopback無認証を区別し、失敗時に切り替えない。
新規通信は15秒timeoutとウィンドウのCancellationTokenを持つ。
Tela依存は別UPM `jp.ludiars.praeforma.tela` だけに置き、本体UIはTelaなしでコンパイルできる。
Tela側branch `feat/pf-unity-residuals` の公開APIを必要とする。未起動のnative processを
このUIから起動せず、Excubitorが起動を所有する。描画データの自動同期は別の残件。

## 受け入れ条件

- プロジェクト変更時に古い仕様が残らず、遅い応答が別プロジェクトを上書きしない。
- 通信失敗でも指示を失わず、再送で別の断片を重複登録しない。
- Editor終了・reload時に新規HTTP要求を中断する。
- Telaパッケージなしで仕様・指示UIが使え、追加時にScene接続できる。
- 保存完了はPfの実行完了と表示しない。

## 検証

Unity 6000.0.59f2付属RoslynとUnity参照DLLでRuntime / Editor / Editor.Tests / 任意Tela adapterを
コンパイルした。追加テストは要求固定、別project応答拒否、空入力拒否、local接続制限を対象とする。
`git diff --check` と `git diff | anatomia verify --repo <worktree>` はPASS（全5項目）。
Unity 2022.3での互換性は未確認。実際のEditor、Pf HTTP応答、Scene overlayでの操作確認は未実施。
現行session-work規則に従い、明示的なテスト指示のない本セッションではテストを実行していない。
起動・再起動・配布・main変更も未実施。

## 復旧

任意Telaパッケージを外してもPf本体UIは残る。全変更を戻す場合はこの変更コミットをrevertする。
サーバーDB・API schemaの変更はない。既に保存された仕様断片を取り消したことにはならない。
ローカル下書きの破棄時は結果不明の要求がPfへ到達済みの可能性をUIで知らせる。
