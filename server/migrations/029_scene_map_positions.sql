-- Scene positions on the transition canvas (spec/schema/scene-map-positions.md).
CREATE TABLE IF NOT EXISTS scene_map_positions (
  layout_id text PRIMARY KEY REFERENCES layouts(id),
  project_id text NOT NULL REFERENCES projects(id),
  x double precision NOT NULL,
  y double precision NOT NULL,
  updated_by text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scene_map_positions_project ON scene_map_positions(project_id);
