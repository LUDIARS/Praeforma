CREATE TABLE IF NOT EXISTS data_designs (
  project_id text PRIMARY KEY REFERENCES projects(id),
  definition jsonb NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
