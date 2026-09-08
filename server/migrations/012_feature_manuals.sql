CREATE TABLE IF NOT EXISTS feature_manuals (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  payload jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feature_manuals_project ON feature_manuals(project_id);
