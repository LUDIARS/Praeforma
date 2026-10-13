-- spec/data/schema/layout.md: Anatomia の解析シーン候補から登録した layout に解析元シーン ID を残す。
-- 手入力のシーンは NULL のまま。同じ解析シーンの二重登録は partial unique index で防ぐ。
ALTER TABLE layouts ADD COLUMN IF NOT EXISTS anatomia_scene_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_layouts_project_anatomia_scene
  ON layouts (project_id, anatomia_scene_id)
  WHERE anatomia_scene_id IS NOT NULL AND deleted_at IS NULL;
