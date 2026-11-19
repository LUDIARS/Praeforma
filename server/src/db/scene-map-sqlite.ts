/** PF-MAP-10: local SQLite mirror of migration 029. */
export const SCENE_MAP_DDL = [
  `CREATE TABLE IF NOT EXISTS scene_map_positions(layout_id TEXT PRIMARY KEY REFERENCES layouts(id), project_id TEXT NOT NULL REFERENCES projects(id), x REAL NOT NULL, y REAL NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_scene_map_positions_project ON scene_map_positions(project_id)`,
];
