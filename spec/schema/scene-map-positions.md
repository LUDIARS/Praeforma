# 遷移図のシーン位置

機能仕様: spec/feature/scene-map.md (PF-MAP-10 / PF-MAP-11)

- scene_map_positions: layout_id主キー (layouts.id、シーン 1 つに位置 1 つ)、project_id (projects.id)、x / y (実数、±100000)、updated_by、updated_at (ISO文字列)。

行が無いシーンは保存していない扱いで、画面側で自動配置する。位置はキャンバス上の見た目だけの情報で、シーン・遷移・仕様の中身は変えない。
シーンを削除しても行は残す (layouts は論理削除のため)。一覧は削除済みのシーンを除いて返す。

migration: server/migrations/029_scene_map_positions.sql (PostgreSQL)、server/src/db/scene-map-sqlite.ts (ローカル SQLite)。
