# シーン編集文書

`scene_documents` は既存 layouts の画面設計を保存する。主キー layout_id、project_id、revision（1から）、payload（JSON）、updated_at。SQLite/PostgreSQL両対応。

payload は canvas（既存UXキャンバスと同じframe/element/transition契約）と sources（画像の指紋・画像・実行時スナップショット・採用先frame）を持つ。旧layout_objectsを初期表示に変換し、旧配置は変更しない。旧配置は3D世界座標のため、canvas契約の範囲へ丸めてから初期表示する。

保存は期待revisionによる比較更新。初回作成も競合検出し、所属プロジェクトとシーンの生存を同時に確認する。閲覧はproject全role、編集・解析はowner/planner。設計案は実行中ゲームへ反映しない。

画像はPNG/JPEG/WebP、最大2MiB。保存要求は最大8MiB。構造情報はversion=1、source、capturedAt、viewport、nodes。nodesは最大200件、id、parentId、label、kind、bounds（左上原点の画面座標）、ontologyRef、sampleTextを持つ。階層の循環や未知参照は拒否する。画像と同時に渡した構造情報は同じキャプチャの資料であることを利用者が確認する。
