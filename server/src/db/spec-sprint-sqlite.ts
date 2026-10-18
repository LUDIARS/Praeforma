/** PF-SPRINT: local SQLite mirror of migration 026. */
export const SPEC_SPRINT_DDL = [
  `CREATE TABLE IF NOT EXISTS spec_sprints(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, goal TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_spec_sprints_project ON spec_sprints(project_id, id)`,
  `CREATE TABLE IF NOT EXISTS spec_sprint_fragments(fragment_id TEXT PRIMARY KEY REFERENCES spec_fragments(id), sprint_id TEXT NOT NULL REFERENCES spec_sprints(id), added_by TEXT NOT NULL, added_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_spec_sprint_fragments_sprint ON spec_sprint_fragments(sprint_id)`,
];
