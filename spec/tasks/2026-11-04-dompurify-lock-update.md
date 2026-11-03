# DOMPurify の指定脆弱版を要求レンジ内で更新

- Actio: actio:0aadfa9c-7e32-400f-b295-8fbb1fb28ff0
- 対象: root package-lock.json の DOMPurify 3.4.15 → 3.4.17。
- 親 Mermaid 11.17.2 の要求 ^3.3.3 内。親、manifest、overrides、他パッケージは変更しない。

## 再利用と検証計画

既存のロック形式、Augur 契約 manifest、log-weaver の契約ラッパーを再利用する。依存解決の全面実行は他項目の更新を招くため採用せず、公開 registry の版メタデータと tarball の SHA-512 を確認して対象の3フィールドだけを更新する。install とライフサイクルスクリプトは実行しない。

augur plan の現状を固定する単体検証案を、本変更では lock 全体の比較に具体化した。回帰検証は正しい更新の受理と、旧版・不正ハッシュ・無関係な依存変更の拒否を対にする。

## 受け入れ条件

C-9 verifyDompurifyLockUpdate(before, after): DOMPurify の版・取得先・整合性だけを 3.4.17 に更新し、親の要求レンジと他の全ロック項目を保持する。

## 検証結果

- 関連する最小の2テストに成功。対象外依存の不変性、旧版と不正ハッシュの拒否を確認した。
- 公開 npm registry の 3.4.17 メタデータと tarball SHA-512 を確認した。
- Augur C-9: covered、4 calls、4 observed、0 violations。既存 C-1〜C-8 は本タスク対象外で未観測。
- git diff --check 成功。全体テスト、サービス操作、実ブラウザ検証は未実施。
- 実行時の挙動は既存の依存要求範囲による互換性を前提とし、今回の検証はロック更新の境界に限定する。
