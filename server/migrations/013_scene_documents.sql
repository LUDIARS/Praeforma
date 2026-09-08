CREATE TABLE IF NOT EXISTS scene_documents (
  layout_id TEXT PRIMARY KEY REFERENCES layouts(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  payload JSONB NOT NULL,
  revision INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
