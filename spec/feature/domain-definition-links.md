# ドメイン定義と要件・シーン・Anatomiaの関連付け

2026-09-08 neco指示。MpのUX定義とは別にPfの機能として実装する。
コア／ビジネスドメインの価値を定義し、要件定義と結び、定義後にAnatomiaの実装ドメインへ対応付ける。
コアドメインはシーン定義への露出を目指すが、未露出でも定義・保存できる。未露出は警告する。

既存Studioのモデルに従い、ドメイン=domains、シーン定義=layouts、要件=specs。
要件との多対多関係は既存spec_targets(kind=domain)を正本とし、別の関係表を増やさない。
露出先はdomains.definition_scene_idsに保存する。シナリオやcanvas frameをシーン定義に代用しない。
Anatomiaのドメインはprojects.anatomia_repoの一覧から選び、既存anatomia_domainに保存する。

- PF-DL-W1: ドメインの価値から要件・シーン定義・実装の対応を同じ画面で読める。
- PF-DL-INV1: coreは価値を定義できればシーン未選択でも保存できる。露出不足を保存拒否にしない。
- PF-DL-INV2: 一覧と編集画面で、有効なシーン定義への参照がないcoreに警告する。
  シーンの削除・非公開化後も有効な参照を再評価する。シーン削除を露出制約で止めない。
- PF-DL-INV3: 要件・シーン・Anatomia参照のプロジェクトを照合する。候補取得失敗を空一覧で隠さない。
- PF-DL-INV4: 定義は版一致で保存する。失敗時はフォームを保持する。
- PF-DL-INV5: 既存ドメインは分類未定義のまま保持する。AIによる境界分析の採用判断を捏造しない。

保存境界はspec-authoring、入力境界はweb-editor。シーンへの露出は責務の所有境界とは別の関連。
Anatomiaの所属・Gate承認を書き換えず、Pfから正本を参照する。
SQLiteは起動時追加列、Postgresはmigration 008。追加列のみで既存資料を維持する。
